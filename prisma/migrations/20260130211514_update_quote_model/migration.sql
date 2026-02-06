/*
  Warnings:

  - Made the column `author` on table `quotes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `category` on table `quotes` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_quotes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT,
    "tone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_quotes" ("author", "category", "createdAt", "id", "text") SELECT "author", "category", "createdAt", "id", "text" FROM "quotes";
DROP TABLE "quotes";
ALTER TABLE "new_quotes" RENAME TO "quotes";
CREATE INDEX "quotes_category_idx" ON "quotes"("category");
CREATE INDEX "quotes_tone_idx" ON "quotes"("tone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
