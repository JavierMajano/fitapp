import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../env';
import type { PrismaClient } from '../db';
import type { SignUpInput, SignInInput } from '../schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SafeUser = {
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
  isOnboarded: boolean;
};

type DbUser = {
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
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_EXPIRY = '30d';

function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function toSafe(user: DbUser & { passwordHash?: string | null }): SafeUser {
  const { passwordHash: _pw, ...rest } = user as DbUser & { passwordHash?: string | null };
  return { ...rest, isOnboarded: rest.goalMode !== null };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function signUp(
  input: SignUpInput,
  db: PrismaClient,
): Promise<{ token: string; user: SafeUser }> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'An account with this email already exists.',
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await db.user.create({
    data: { email: input.email, name: input.name, passwordHash },
  });

  return { token: signToken(user.id, user.email), user: toSafe(user) };
}

export async function signIn(
  input: SignInInput,
  db: PrismaClient,
): Promise<{ token: string; user: SafeUser }> {
  const user = await db.user.findUnique({ where: { email: input.email } });

  if (!user || !user.passwordHash) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatch) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
  }

  return { token: signToken(user.id, user.email), user: toSafe(user) };
}

export async function getSafeUser(userId: string, db: PrismaClient): Promise<SafeUser> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
  return toSafe(user);
}
