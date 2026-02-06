-- CreateTable
CREATE TABLE "simulation_scenarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulation_scenarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "simulation_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "simulatedCTL" REAL NOT NULL,
    "simulatedATL" REAL NOT NULL,
    "simulatedTSB" REAL NOT NULL,
    "simulatedReadinessAvg" INTEGER NOT NULL,
    "simulatedBurnoutRisk" INTEGER NOT NULL,
    "weeklyTSS" INTEGER,
    "insightsJson" TEXT,
    "warningsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulation_results_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "simulation_scenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "simulation_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "simulation_scenarios_userId_idx" ON "simulation_scenarios"("userId");

-- CreateIndex
CREATE INDEX "simulation_results_userId_idx" ON "simulation_results"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_results_scenarioId_weekIndex_key" ON "simulation_results"("scenarioId", "weekIndex");
