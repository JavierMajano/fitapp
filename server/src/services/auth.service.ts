import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import type { SignUpInput, SignInInput } from '../schemas';

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '30d';

export type SafeUser = {
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
  isOnboarded: boolean;
};

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

function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRY });
}

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

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
    },
    select: {
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
    },
  });

  const token = signToken(user.id, user.email);
  return { token, user: toSafeUser(user) };
}

export async function signIn(
  input: SignInInput,
  db: PrismaClient,
): Promise<{ token: string; user: SafeUser }> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
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
      passwordHash: true,
    },
  });

  // Return the same error whether the email doesn't exist or the password is wrong
  // to avoid leaking which emails are registered
  const invalidError = new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'Invalid email or password.',
  });

  if (!user || !user.passwordHash) throw invalidError;

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw invalidError;

  const token = signToken(user.id, user.email);
  return { token, user: toSafeUser(user) };
}

export async function getSafeUser(userId: string, db: PrismaClient): Promise<SafeUser> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
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
    },
  });

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
  }

  return toSafeUser(user);
}
