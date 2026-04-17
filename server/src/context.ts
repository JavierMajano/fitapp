import { getSession } from '@auth/express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { authConfig } from './auth';
import { db } from './db';
import { env } from './env';
import { redis } from './redis';

type SessionUser = { id: string; email: string };
type Session = { user: SessionUser } | null;

async function resolveSession(req: Request, _res: Response): Promise<Session> {
  const authHeader = req.headers.authorization;

  // Mobile clients send a Bearer JWT in the Authorization header
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as {
        sub: string;
        email: string;
      };
      return { user: { id: payload.sub, email: payload.email } };
    } catch {
      // Expired or invalid token — fall through to unauthenticated
      return null;
    }
  }

  // Web/OAuth clients use Auth.js cookie sessions
  const cookieSession = await getSession(req, authConfig);
  if (cookieSession?.user?.id) {
    return {
      user: {
        id: cookieSession.user.id,
        email: cookieSession.user.email ?? '',
      },
    };
  }

  return null;
}

export async function createContext({ req, res }: { req: Request; res: Response }) {
  const session = await resolveSession(req, res);
  return { db, redis, session, req, res };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
