import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { Context } from './context';
import { signUpSchema, signInSchema, onboardingSchema } from './schemas';
import * as authService from './services/auth.service';
import * as foodService from './services/food.service';
import * as socialService from './services/social.service';
import * as userService from './services/user.service';
import * as workoutService from './services/workout.service';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// Throws UNAUTHORIZED if no valid session; injects userId into ctx
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, userId: ctx.session.user.id } });
});

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok' as const })),

  auth: router({
    signUp: publicProcedure.input(signUpSchema).mutation(async ({ input, ctx }) => {
      return authService.signUp(input, ctx.db);
    }),

    signIn: publicProcedure.input(signInSchema).mutation(async ({ input, ctx }) => {
      return authService.signIn(input, ctx.db);
    }),

    me: protectedProcedure.query(async ({ ctx }) => {
      return authService.getSafeUser(ctx.userId, ctx.db);
    }),

    googleSignIn: publicProcedure
      .input(z.object({ idToken: z.string() }))
      .mutation(async ({ input, ctx }) => socialService.googleSignIn(input.idToken, ctx.db)),
  }),

  user: router({
    updateProfile: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100).optional() }))
      .mutation(() => ({ todo: true })),

    completeOnboard: protectedProcedure.input(onboardingSchema).mutation(async ({ input, ctx }) => {
      return userService.completeOnboard(ctx.userId, input, ctx.db);
    }),
  }),

  food: router({
    search: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input, ctx }) => foodService.searchFood(input.query, ctx.redis)),

    byBarcode: publicProcedure
      .input(z.object({ barcode: z.string() }))
      .query(async ({ input, ctx }) => foodService.getByBarcode(input.barcode, ctx.redis)),

    logEntry: protectedProcedure
      .input(
        z.object({
          foodItemId: z.string().uuid(),
          mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']),
          quantityGrams: z.number().positive(),
        }),
      )
      .mutation(() => ({ todo: true })),
  }),

  workout: router({
    listRoutines: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.session?.user?.id ?? null;
      return workoutService.listRoutines(userId, ctx.db);
    }),

    startSession: protectedProcedure
      .input(z.object({ routineId: z.string().uuid().optional() }))
      .mutation(async ({ input, ctx }) => {
        return workoutService.startSession(ctx.userId, input, ctx.db);
      }),

    logSet: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().uuid(),
          exerciseId: z.string().uuid(),
          setNumber: z.number().int().positive(),
          weightKg: z.number().nonnegative().optional(),
          reps: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return workoutService.logSet(ctx.userId, input, ctx.db);
      }),

    endSession: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return workoutService.endSession(ctx.userId, input, ctx.db);
      }),
  }),
});

export type AppRouter = typeof appRouter;
