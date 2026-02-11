import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { createSign } from "node:crypto";
import { compare } from "bcryptjs";
import { db } from "./db";
import { z } from "zod";

function parseTrialDays(): number {
  const raw = process.env.TRIAL_DAYS ?? process.env.BILLING_TRIAL_DAYS;
  if (!raw) return 14;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 14;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createAppleClientSecret(params: {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24 * 180; // 180 days (<= 6 months)

  const header = { alg: "ES256", kid: params.keyId, typ: "JWT" };
  const payload = {
    iss: params.teamId,
    iat,
    exp,
    aud: "https://appleid.apple.com",
    sub: params.clientId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: params.privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64url(signature)}`;
}

const appleClientSecret =
  process.env.APPLE_CLIENT_SECRET ??
  (process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY
    ? createAppleClientSecret({
        clientId: process.env.APPLE_CLIENT_ID,
        teamId: process.env.APPLE_TEAM_ID,
        keyId: process.env.APPLE_KEY_ID,
        privateKey: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      })
    : undefined);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(process.env.APPLE_CLIENT_ID && appleClientSecret
      ? [
          Apple({
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: appleClientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      // Ensure OAuth-created users get the same trial fields as email/password signups.
      const now = new Date();
      const trialEndsAt = addDays(now, parseTrialDays());
      await db.user.update({
        where: { id: user.id },
        data: {
          trialStartedAt: now,
          trialEndsAt,
        },
      });
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export type Session = Awaited<ReturnType<typeof auth>>;
