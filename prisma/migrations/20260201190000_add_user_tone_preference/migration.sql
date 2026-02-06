-- Add missing column introduced in schema.prisma (User.tonePreference)
-- SQLite stores enums as TEXT; default aligns with schema default (SUPPORTIVE)
ALTER TABLE "users" ADD COLUMN "tonePreference" TEXT NOT NULL DEFAULT 'SUPPORTIVE';
