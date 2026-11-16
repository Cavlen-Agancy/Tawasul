-- Distinct platform administrator role. Existing STAFF users are not migrated.
ALTER TYPE "AccountType" ADD VALUE 'ADMIN';
