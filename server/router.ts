import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok' })),

  // Auth routes (Phase 3)
  auth: router({
    signUp: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string() }))
      .mutation(async () => ({ todo: true })),
    signIn: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async () => ({ todo: true })),
    me: publicProcedure.query(async () => null),
  }),

  // User routes (Phase 3)
  user: router({
    updateProfile: publicProcedure
      .input(z.object({ name: z.string().optional() }))
      .mutation(async () => ({ todo: true })),
    completeOnboard: publicProcedure
      .input(
        z.object({
          goalMode: z.enum(['bulk', 'maintenance', 'cut']),
          weightKg: z.number(),
          heightCm: z.number(),
          age: z.number(),
          sex: z.enum(['male', 'female']),
          activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
        }),
      )
      .mutation(async () => ({ todo: true })),
  }),

  // Food routes (Phase 4+)
  food: router({
    search: publicProcedure.input(z.object({ query: z.string() })).query(async () => []),
    byBarcode: publicProcedure.input(z.object({ barcode: z.string() })).query(async () => null),
    logEntry: publicProcedure
      .input(z.object({ foodItemId: z.string(), mealType: z.string(), quantityGrams: z.number() }))
      .mutation(async () => ({ todo: true })),
  }),

  // Workout routes (Phase 4+)
  workout: router({
    listRoutines: publicProcedure.query(async () => []),
    startSession: publicProcedure
      .input(z.object({ routineId: z.string().optional() }))
      .mutation(async () => ({ todo: true })),
    logSet: publicProcedure
      .input(
        z.object({
          sessionId: z.string(),
          exerciseId: z.string(),
          setNumber: z.number(),
          weightKg: z.number(),
          reps: z.number(),
        }),
      )
      .mutation(async () => ({ todo: true })),
    endSession: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async () => ({ todo: true })),
  }),
});

export type AppRouter = typeof appRouter;
