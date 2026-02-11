"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Apple, Chrome, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [providers, setProviders] = useState<
    Record<string, { id: string; name: string; type: string }> | null
  >(null);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "apple">(null);

  useEffect(() => {
    void getProviders()
      .then((p) => setProviders(p))
      .catch(() => setProviders(null));
  }, []);

  const hasOAuth = Boolean(providers?.google || providers?.apple);

  async function onOAuth(providerId: "google" | "apple") {
    setOauthLoading(providerId);
    try {
      await signIn(providerId, { callbackUrl });
    } catch {
      toast.error(t("somethingWrong"));
      setOauthLoading(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("registrationFailed"));
        setIsLoading(false);
        return;
      }

      toast.success(t("accountCreated"));
      router.push("/login");
    } catch {
      toast.error(t("somethingWrong"));
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/stock/processed/abstract-dark-texture-01-hero.webp"
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/85 to-background" />
          <div className="absolute inset-0 opacity-80 [background:radial-gradient(600px_circle_at_20%_10%,rgba(255,122,24,.18),transparent_60%),radial-gradient(700px_circle_at_80%_0%,rgba(168,85,247,.14),transparent_60%),radial-gradient(900px_circle_at_50%_100%,rgba(30,58,138,.18),transparent_60%)]" />
        </div>

        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo variant="lockup" size={30} className="h-7" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground">{t("hasAccount")}</span>
              <Button asChild variant="ghost" size="sm" className="rounded-xl">
                <Link href="/login">{t("signIn")}</Link>
              </Button>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:gap-8 lg:grid-cols-2 items-stretch">
            {/* Form */}
            <Card className="w-full bg-card/40 backdrop-blur-md border-white/10 shadow-card hover:shadow-card">
              <CardHeader className="text-left">
                <CardTitle className="text-lg">{t("createAccountTitle")}</CardTitle>
                <CardDescription>{t("createAccountDesc")}</CardDescription>
              </CardHeader>

              <form onSubmit={onSubmit}>
                <CardContent className="space-y-4">
                  {hasOAuth && (
                    <div className="space-y-3">
                      {providers?.google && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-2xl border-white/15 bg-white/0 hover:bg-white/5"
                          disabled={isLoading || oauthLoading !== null}
                          onClick={() => onOAuth("google")}
                        >
                          {oauthLoading === "google" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Continue with Google
                            </>
                          ) : (
                            <>
                              <Chrome className="mr-2 h-4 w-4" />
                              Continue with Google
                            </>
                          )}
                        </Button>
                      )}
                      {providers?.apple && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-2xl border-white/15 bg-white/0 hover:bg-white/5"
                          disabled={isLoading || oauthLoading !== null}
                          onClick={() => onOAuth("apple")}
                        >
                          {oauthLoading === "apple" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Continue with Apple
                            </>
                          ) : (
                            <>
                              <Apple className="mr-2 h-4 w-4" />
                              Continue with Apple
                            </>
                          )}
                        </Button>
                      )}

                      <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/60" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-background/80 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
                            Or email
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={isLoading}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    No credit card • Takes 30 seconds • Privacy‑first
                  </p>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                  <Button type="submit" className="w-full rounded-2xl h-11 shadow-soft" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("creatingAccount")}
                      </>
                    ) : (
                      t("createAccount")
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    {t("hasAccount")}{" "}
                    <Link href="/login" className="text-primary hover:underline">
                      {t("signIn")}
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>

            {/* Benefits / visual */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-card">
              <div className="absolute inset-0">
                <Image
                  src="/stock/processed/cyclist-road-sunset-01-hero.webp"
                  alt=""
                  aria-hidden
                  fill
                  sizes="(min-width: 1024px) 520px, 92vw"
                  className="object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/80 to-background" />
              </div>

              <div className="relative p-7 sm:p-8 h-full flex flex-col">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Beta</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance text-white">
                  Start in under a minute.
                </h2>
                <p className="mt-3 text-sm text-white/70 max-w-md">
                  Join the beta and get the adaptive planning loop from day one.
                </p>

                <div className="mt-7 space-y-3">
                  {[
                    { title: "Daily check‑in", body: "30 seconds and you’re ready to train." },
                    { title: "Alternatives built‑in", body: "Bad day? Short day? You still move forward." },
                    { title: "Privacy‑first", body: "Your data stays yours." },
                  ].map((b) => (
                    <div key={b.title} className="rounded-2xl border border-white/10 bg-black/25 backdrop-blur px-4 py-3">
                      <div className="text-sm font-medium text-white/90">{b.title}</div>
                      <div className="mt-1 text-xs text-white/65">{b.body}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/65">
                  {["No credit card", "Takes 30 seconds", "Privacy‑first"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
