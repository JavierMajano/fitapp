import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import type { SignUpInput, SignInInput } from '../schemas';

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

type StoredUser = SafeUser & { password: string };

// In-memory store — shared across all services in this process
export const users = new Map<string, StoredUser>();
let nextId = 1;

/** Reset in-memory state between test runs. */
export function clearUsers(): void {
  users.clear();
  nextId = 1;
}

const JWT_EXPIRY = '30d';

function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, process.env.JWT_SECRET ?? 'dev-secret', {
    expiresIn: JWT_EXPIRY,
  });
}

function toSafe({ password: _p, ...u }: StoredUser): SafeUser {
  return u;
}

export async function signUp(
  input: SignUpInput,
  _db: unknown,
): Promise<{ token: string; user: SafeUser }> {
  if ([...users.values()].some((u) => u.email === input.email)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'An account with this email already exists.',
    });
  }

  const id = String(nextId++);
  const user: StoredUser = {
    id,
    email: input.email,
    name: input.name,
    avatarUrl: null,
    goalMode: null,
    tdeeCalories: null,
    calorieTarget: null,
    proteinTargetG: null,
    carbsTargetG: null,
    fatTargetG: null,
    isOnboarded: false,
    password: await bcrypt.hash(input.password, 10),
  };
  users.set(id, user);

  return { token: signToken(id, input.email), user: toSafe(user) };
}

export async function signIn(
  input: SignInInput,
  _db: unknown,
): Promise<{ token: string; user: SafeUser }> {
  const user = [...users.values()].find((u) => u.email === input.email);

  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password);
  if (!passwordMatch) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
  }

  return { token: signToken(user.id, user.email), user: toSafe(user) };
}

export async function getSafeUser(userId: string, _db: unknown): Promise<SafeUser> {
  const user = users.get(userId);
  if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
  return toSafe(user);
}
