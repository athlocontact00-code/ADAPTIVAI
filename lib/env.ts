import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
    NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
    NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    INTERNAL_CRON_SECRET: z.string().optional(),

    APP_URL: z.string().url().optional(),
    BILLING_GRACE_DAYS: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_ID_PRO: z.string().optional(),
    STRIPE_PRODUCT_ID_PRO: z.string().optional(),

    OPENAI_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.INTERNAL_CRON_SECRET || data.INTERNAL_CRON_SECRET.length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["INTERNAL_CRON_SECRET"],
          message: "INTERNAL_CRON_SECRET is required in production (min 16 chars)",
        });
      }
    }

    const stripeAny = Boolean(
      (data.STRIPE_SECRET_KEY && data.STRIPE_SECRET_KEY.length > 0) ||
        (data.STRIPE_WEBHOOK_SECRET && data.STRIPE_WEBHOOK_SECRET.length > 0) ||
        (data.STRIPE_PRICE_ID_PRO && data.STRIPE_PRICE_ID_PRO.length > 0)
    );

    if (stripeAny) {
      if (!data.APP_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["APP_URL"],
          message: "APP_URL is required when Stripe billing is configured",
        });
      }
      if (!data.STRIPE_SECRET_KEY || data.STRIPE_SECRET_KEY.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_SECRET_KEY"],
          message: "STRIPE_SECRET_KEY is required when Stripe billing is configured",
        });
      }
      if (!data.STRIPE_WEBHOOK_SECRET || data.STRIPE_WEBHOOK_SECRET.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_WEBHOOK_SECRET"],
          message: "STRIPE_WEBHOOK_SECRET is required when Stripe billing is configured",
        });
      }
      if (!data.STRIPE_PRICE_ID_PRO || data.STRIPE_PRICE_ID_PRO.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_PRICE_ID_PRO"],
          message: "STRIPE_PRICE_ID_PRO is required when Stripe billing is configured",
        });
      }
    }

    if (data.OPENAI_API_KEY && data.OPENAI_API_KEY.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY looks too short",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("\n❌ Environment validation failed:\n");
    parsed.error.issues.forEach((issue) => {
      console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
    });
    console.error("\n📋 Required environment variables:");
    console.error("  - DATABASE_URL: Database connection string (Neon pooled/pgbouncer)");
    console.error("  - DIRECT_URL: Direct connection string (Neon, for migrations)");
    console.error("  - NEXTAUTH_URL: Base URL for NextAuth (e.g., http://localhost:3000)");
    console.error("  - NEXTAUTH_SECRET: Secret key for NextAuth (min 32 chars)");
    console.error("\n💡 Copy .env.example to .env and fill in the values.\n");
    
    throw new Error("Environment validation failed");
  }

  return parsed.data;
}

let _env: Env | null = null;

function getEnv(): Env {
  if (_env === null) {
    _env = validateEnv();
  }
  return _env;
}

/** Lazily validated env; validation runs on first access, not at import time (avoids build failures). */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === "development";
}

/** @deprecated Project uses PostgreSQL only; kept for compatibility. */
export function isSQLite(): boolean {
  return false;
}

export function isPostgres(): boolean {
  const url = getEnv().DATABASE_URL;
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}
