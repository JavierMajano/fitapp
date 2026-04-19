import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

import type { Context } from './context';
import {
  signUpSchema,
  signInSchema,
  onboardingSchema,
  updateProfileSchema,
  updateSettingsSchema,
  logFoodEntrySchema,
  updateFoodEntrySchema,
} from './schemas';
import * as authService from './services/auth.service';
import * as bodyService from './services/body.service';
import * as foodService from './services/food.service';
import * as progressService from './services/progress.service';
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

  // ─── auth ────────────────────────────────────────────────────────────────────

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

  // ─── user ────────────────────────────────────────────────────────────────────

  user: router({
    updateProfile: protectedProcedure
      .input(updateProfileSchema)
      .mutation(async ({ input, ctx }) => {
        return userService.updateProfile(ctx.userId, input, ctx.db);
      }),

    completeOnboard: protectedProcedure.input(onboardingSchema).mutation(async ({ input, ctx }) => {
      return userService.completeOnboard(ctx.userId, input, ctx.db);
    }),

    getSettings: protectedProcedure.query(async ({ ctx }) => {
      return userService.getSettings(ctx.userId, ctx.db);
    }),

    updateSettings: protectedProcedure
      .input(updateSettingsSchema)
      .mutation(async ({ input, ctx }) => {
        return userService.updateSettings(ctx.userId, input, ctx.db);
      }),
  }),

  // ─── food ────────────────────────────────────────────────────────────────────

  food: router({
    search: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input, ctx }) => foodService.searchFood(input.query, ctx.redis)),

    byBarcode: publicProcedure
      .input(z.object({ barcode: z.string() }))
      .query(async ({ input, ctx }) => foodService.getByBarcode(input.barcode, ctx.redis)),

    getDailyLog: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ input, ctx }) => {
        return foodService.getDailyFoodLog(ctx.userId, input.date, ctx.db);
      }),

    logEntry: protectedProcedure.input(logFoodEntrySchema).mutation(async ({ input, ctx }) => {
      return foodService.logFoodEntry(ctx.userId, input, ctx.db);
    }),

    updateEntry: protectedProcedure
      .input(updateFoodEntrySchema)
      .mutation(async ({ input, ctx }) => {
        return foodService.updateFoodEntry(ctx.userId, input, ctx.db);
      }),

    deleteEntry: protectedProcedure
      .input(z.object({ entryId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return foodService.deleteFoodEntry(ctx.userId, input.entryId, ctx.db);
      }),
  }),

  // ─── workout ─────────────────────────────────────────────────────────────────

  workout: router({
    listRoutines: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.session?.user?.id ?? null;
      return workoutService.listRoutinesDb(userId, ctx.db);
    }),

    listExercises: publicProcedure.query(async ({ ctx }) => {
      return workoutService.listExercises(ctx.db);
    }),

    startSession: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).optional(),
          routineId: z.string().uuid().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return workoutService.startSessionDb(ctx.userId, input, ctx.db);
      }),

    logSet: protectedProcedure
      .input(
        z.object({
          sessionId: z.string().uuid(),
          exerciseName: z.string().min(1),
          setNumber: z.number().int().positive(),
          weightKg: z.number().nonnegative().optional(),
          reps: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return workoutService.logSetDb(ctx.userId, input, ctx.db);
      }),

    endSession: protectedProcedure
      .input(z.object({ sessionId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return workoutService.endSessionDb(ctx.userId, input, ctx.db);
      }),

    getSessionsByDate: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ input, ctx }) => {
        return workoutService.getSessionsByDate(ctx.userId, input.date, ctx.db);
      }),

    updateSet: protectedProcedure
      .input(
        z.object({
          setId: z.string().uuid(),
          weightKg: z.number().nonnegative().optional(),
          reps: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return workoutService.updateSet(ctx.userId, input, ctx.db);
      }),

    deleteSet: protectedProcedure
      .input(z.object({ setId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return workoutService.deleteSet(ctx.userId, input.setId, ctx.db);
      }),
  }),

  // ─── body ────────────────────────────────────────────────────────────────────

  body: router({
    logWeight: protectedProcedure
      .input(
        z.object({
          weightKg: z.number().positive().max(500),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          bodyFatPct: z.number().min(0).max(100).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        return bodyService.logWeight(ctx.userId, input, ctx.db);
      }),

    getHistory: protectedProcedure
      .input(
        z.object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .query(async ({ input, ctx }) => {
        return bodyService.getWeightHistory(ctx.userId, input, ctx.db);
      }),
  }),

  // ─── progress ────────────────────────────────────────────────────────────────

  progress: router({
    getCalorieHistory: protectedProcedure
      .input(
        z.object({
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .query(async ({ input, ctx }) => {
        return progressService.getCalorieHistory(ctx.userId, input, ctx.db);
      }),

    getStrengthHistory: protectedProcedure
      .input(
        z.object({
          exerciseId: z.string().uuid(),
          startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .query(async ({ input, ctx }) => {
        return progressService.getStrengthHistory(ctx.userId, input, ctx.db);
      }),
  }),
});

export type AppRouter = typeof appRouter;
