import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

import type { SafeUser } from './auth.service';

const JWT_EXPIRY = '30d';

function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRY });
}

function toSafeUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  goalMode: string | null;
  tdeeCalories: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    goalMode: user.goalMode,
    tdeeCalories: user.tdeeCalories,
    calorieTarget: user.calorieTarget,
    proteinTargetG: user.proteinTargetG,
    carbsTargetG: user.carbsTargetG,
    fatTargetG: user.fatTargetG,
    isOnboarded: user.goalMode !== null,
  };
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  goalMode: true,
  tdeeCalories: true,
  calorieTarget: true,
  proteinTargetG: true,
  carbsTargetG: true,
  fatTargetG: true,
} as const;

async function findOrCreateUser(
  email: string,
  name: string,
  db: PrismaClient,
): Promise<{ token: string; user: SafeUser }> {
  const existing = await db.user.findUnique({ where: { email }, select: USER_SELECT });

  const dbUser =
    existing ??
    (await db.user.create({
      data: { email, name, passwordHash: null },
      select: USER_SELECT,
    }));

  const token = signToken(dbUser.id, dbUser.email);
  return { token, user: toSafeUser(dbUser) };
}

export async function googleSignIn(
  idToken: string,
  db: PrismaClient,
): Promise<{ token: string; user: SafeUser }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Google auth not configured.' });
  }

  let email: string;
  let name: string;

  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new Error('No email in token payload');
    }
    email = payload.email;
    name = payload.name ?? email.split('@')[0];
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid Google token.' });
  }

  return findOrCreateUser(email, name, db);
}
