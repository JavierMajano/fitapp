-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "goalMode" TEXT,
    "weightKg" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "age" INTEGER,
    "sex" TEXT,
    "activityLevel" TEXT,
    "tdeeCalories" INTEGER,
    "calorieTarget" INTEGER,
    "proteinTargetG" INTEGER,
    "carbsTargetG" INTEGER,
    "fatTargetG" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitSystem" TEXT NOT NULL DEFAULT 'metric',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "weeklyWeighInDay" INTEGER NOT NULL DEFAULT 1,
    "defaultRestSeconds" INTEGER NOT NULL DEFAULT 90,
    "notificationReminders" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bodyFatPct" DOUBLE PRECISION,
    "muscleMassKg" DOUBLE PRECISION,
    "notes" TEXT,
    "photoUrl" TEXT,
    "loggedDate" DATE NOT NULL,

    CONSTRAINT "body_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalMode" TEXT NOT NULL,
    "calorieTarget" INTEGER NOT NULL,
    "proteinTargetG" INTEGER NOT NULL,
    "carbsTargetG" INTEGER NOT NULL,
    "fatTargetG" INTEGER NOT NULL,
    "startedAt" DATE NOT NULL,
    "endedAt" DATE,

    CONSTRAINT "goal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "daysPerWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_days" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "routine_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_exercises" (
    "id" TEXT NOT NULL,
    "routineDayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "restSeconds" INTEGER NOT NULL DEFAULT 90,
    "notes" TEXT,

    CONSTRAINT "routine_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "equipment" TEXT,
    "movementType" TEXT,
    "difficulty" TEXT,
    "instructions" TEXT,
    "videoUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'custom',
    "sourceRefId" TEXT,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_muscles" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscleId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "exercise_muscles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muscles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "bodyRegion" TEXT NOT NULL,

    CONSTRAINT "muscles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routineId" TEXT,
    "routineDayId" TEXT,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "perceivedEffort" INTEGER,
    "caloriesBurned" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_sets" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "setType" TEXT NOT NULL DEFAULT 'working',
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "durationSeconds" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "session_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardio_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "distanceKm" DOUBLE PRECISION,
    "caloriesBurned" INTEGER,
    "avgHeartRate" INTEGER,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardio_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "barcode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'custom',
    "sourceRefId" TEXT,
    "caloriesPer100g" INTEGER NOT NULL,
    "proteinPer100g" DOUBLE PRECISION NOT NULL,
    "carbsPer100g" DOUBLE PRECISION NOT NULL,
    "fatPer100g" DOUBLE PRECISION NOT NULL,
    "fiberPer100g" DOUBLE PRECISION,
    "sugarPer100g" DOUBLE PRECISION,
    "sodiumPer100g" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_servings" (
    "id" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "food_servings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "totalCalories" INTEGER NOT NULL DEFAULT 0,
    "totalProteinG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCarbsG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFatG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFiberG" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_log_entries" (
    "id" TEXT NOT NULL,
    "foodLogId" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "foodServingId" TEXT,
    "mealType" TEXT NOT NULL,
    "quantityGrams" DOUBLE PRECISION NOT NULL,
    "calories" INTEGER NOT NULL,
    "proteinG" DOUBLE PRECISION NOT NULL,
    "carbsG" DOUBLE PRECISION NOT NULL,
    "fatG" DOUBLE PRECISION NOT NULL,
    "fiberG" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "food_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMl" DOUBLE PRECISION NOT NULL,
    "logDate" DATE NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_source_sourceRefId_key" ON "exercises"("source", "sourceRefId");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_muscles_exerciseId_muscleId_key" ON "exercise_muscles"("exerciseId", "muscleId");

-- CreateIndex
CREATE UNIQUE INDEX "muscles_name_key" ON "muscles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "food_items_source_sourceRefId_key" ON "food_items"("source", "sourceRefId");

-- CreateIndex
CREATE UNIQUE INDEX "food_logs_userId_logDate_key" ON "food_logs"("userId", "logDate");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_logs" ADD CONSTRAINT "body_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_history" ADD CONSTRAINT "goal_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_days" ADD CONSTRAINT "routine_days_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routineDayId_fkey" FOREIGN KEY ("routineDayId") REFERENCES "routine_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_muscles" ADD CONSTRAINT "exercise_muscles_muscleId_fkey" FOREIGN KEY ("muscleId") REFERENCES "muscles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_routineDayId_fkey" FOREIGN KEY ("routineDayId") REFERENCES "routine_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardio_sessions" ADD CONSTRAINT "cardio_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_servings" ADD CONSTRAINT "food_servings_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_foodLogId_fkey" FOREIGN KEY ("foodLogId") REFERENCES "food_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "food_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_foodServingId_fkey" FOREIGN KEY ("foodServingId") REFERENCES "food_servings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
