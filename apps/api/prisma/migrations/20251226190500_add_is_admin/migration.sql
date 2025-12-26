-- Add isAdmin boolean to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAdmin" boolean NOT NULL DEFAULT false;
