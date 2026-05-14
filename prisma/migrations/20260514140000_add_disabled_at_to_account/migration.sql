-- AlterTable: Add disabledAt column to Account for circuit breaker auto-recovery
ALTER TABLE "Account" ADD COLUMN "disabledAt" DATETIME;