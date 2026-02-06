async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.startsWith("postgres")) {
    console.log("PostgreSQL: patch script skipped (use Prisma migrations).");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  // SQLite pragma returns rows like: { cid, name, type, notnull, dflt_value, pk }
  try {
    let didWork = false;

    // 1) users.tonePreference
    {
      const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("users")');
      const hasTonePreference = Array.isArray(cols) && cols.some((c) => c && c.name === "tonePreference");

      if (!hasTonePreference) {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE \"users\" ADD COLUMN \"tonePreference\" TEXT NOT NULL DEFAULT 'SUPPORTIVE'"
        );
        console.log("Added users.tonePreference with default SUPPORTIVE");
        didWork = true;
      }
    }

    // 3) profiles.planRigidity
    {
      const tables = await prisma.$queryRawUnsafe(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'"
      );
      const hasProfiles = Array.isArray(tables) && tables.length > 0;

      if (hasProfiles) {
        const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("profiles")');
        const hasPlanRigidity = Array.isArray(cols) && cols.some((c) => c && c.name === "planRigidity");

        if (!hasPlanRigidity) {
          await prisma.$executeRawUnsafe(
            "ALTER TABLE \"profiles\" ADD COLUMN \"planRigidity\" TEXT NOT NULL DEFAULT 'LOCKED_1_DAY'"
          );
          console.log("Added profiles.planRigidity with default LOCKED_1_DAY");
          didWork = true;
        }
      }
    }

    // 2) daily_checkins.readinessScore
    {
      const tables = await prisma.$queryRawUnsafe(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_checkins'"
      );
      const hasDailyCheckIns = Array.isArray(tables) && tables.length > 0;

      if (hasDailyCheckIns) {
        const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("daily_checkins")');
        const hasReadinessScore = Array.isArray(cols) && cols.some((c) => c && c.name === "readinessScore");

        if (!hasReadinessScore) {
          await prisma.$executeRawUnsafe(
            "ALTER TABLE \"daily_checkins\" ADD COLUMN \"readinessScore\" INTEGER"
          );
          console.log("Added daily_checkins.readinessScore");
          didWork = true;
        }
      }
    }

    if (!didWork) {
      console.log("OK: no DB patches needed");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {});
