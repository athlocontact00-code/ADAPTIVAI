-- CreateTable
CREATE TABLE "performance_benchmarks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "swimCssSecPer100" INTEGER,
    "swim400TimeSec" INTEGER,
    "swim100TimeSec" INTEGER,
    "run5kTimeSec" INTEGER,
    "run10kTimeSec" INTEGER,
    "runThresholdSecPerKm" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "performance_benchmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "performance_benchmarks_userId_key" ON "performance_benchmarks"("userId");

-- CreateIndex
CREATE INDEX "performance_benchmarks_userId_idx" ON "performance_benchmarks"("userId");

