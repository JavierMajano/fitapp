import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';

import { users } from './auth.service';
import type { SafeUser } from './auth.service';

const JWT_EXPIRY = '30d';
let nextGoogleId = 1000;

function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, process.env.JWT_SECRET ?? 'dev-secret', {
    expiresIn: JWT_EXPIRY,
  });
}

export async function googleSignIn(
  _idToken: string,
  _db: unknown,
): Promise<{ token: string; user: SafeUser }> {
  // Mock: decode the idToken as a simple JSON payload or use a fake email
  let email: string;
  let name: string;

  try {
    // Try to parse base64-encoded mock token (for testing without real Google)
    const payload = JSON.parse(Buffer.from(_idToken.split('.')[1] ?? '', 'base64').toString());
    email = payload.email ?? 'google-user@example.com';
    name = payload.name ?? 'Google User';
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid Google token.' });
  }

  const existing = [...users.values()].find((u) => u.email === email);
  if (existing) {
    return {
      token: signToken(existing.id, existing.email),
      user: {
        id: existing.id,
        email: existing.email,
        name: existing.name,
        avatarUrl: existing.avatarUrl,
        goalMode: existing.goalMode,
        tdeeCalories: existing.tdeeCalories,
        calorieTarget: existing.calorieTarget,
        proteinTargetG: existing.proteinTargetG,
        carbsTargetG: existing.carbsTargetG,
        fatTargetG: existing.fatTargetG,
        isOnboarded: existing.isOnboarded,
      },
    };
  }

  const id = String(nextGoogleId++);
  const user = {
    id,
    email,
    name,
    avatarUrl: null,
    goalMode: null as string | null,
    tdeeCalories: null as number | null,
    calorieTarget: null as number | null,
    proteinTargetG: null as number | null,
    carbsTargetG: null as number | null,
    fatTargetG: null as number | null,
    isOnboarded: false,
    password: '',
  };
  users.set(id, user);

  return {
    token: signToken(id, email),
    user: {
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
      isOnboarded: user.isOnboarded,
    },
  };
}
