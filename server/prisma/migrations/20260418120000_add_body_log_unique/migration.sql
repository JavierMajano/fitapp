-- Add unique constraint to body_logs so that upsert by (userId, loggedDate) works
-- This fixes the "Invalid db.bodyLog.upsert() invocation" error at runtime.
ALTER TABLE "body_logs" ADD CONSTRAINT "body_logs_userId_loggedDate_key" UNIQUE ("userId", "loggedDate");
