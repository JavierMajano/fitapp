import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';

import { env } from '../env';
import type { PrismaClient } from '../db';
import type { SafeUser } from './auth.service';

const JWT_EXPIRY = '30d';

function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function toSafe(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  goalMode: string | null;
  weightKg: number | null;
  tdeeCalories: number | null;
  calorieTarget: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  goalWeightKg: number | null;
  goalTargetDate: Date | null;
}): SafeUser {
  return { ...user, isOnboarded: user.goalMode !== null };
}

export async function googleSignIn(
  _idToken: string,
  db: PrismaClient,
): Promise<{ token: string; user: SafeUser }> {
  let email: string;
  let name: string;

  try {
    const payload = JSON.parse(Buffer.from(_idToken.split('.')[1] ?? '', 'base64').toString()) as {
      email?: string;
      name?: string;
    };
    email = payload.email ?? 'google-user@example.com';
    name = payload.name ?? 'Google User';
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid Google token.' });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { token: signToken(existing.id, existing.email), user: toSafe(existing) };
  }

  const user = await db.user.create({ data: { email, name } });
  return { token: signToken(user.id, user.email), user: toSafe(user) };
}
