"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Apple, Chrome, Loader2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, Variants } from "framer-motion";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/dashboard";
  const registerHref =
    callbackUrl === "/dashboard"
      ? "/register"
      : `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const [isLoading, setIsLoading] = useState(false);
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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(t("invalidCredentials"));
        setIsLoading(false);
        return;
      }

      toast.success(t("welcomeBack"));
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error(t("somethingWrong"));
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-transparent overflow-hidden text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground shadow-card"
      >
        Skip to content
      </a>
      <div className="relative min-h-screen flex items-center justify-center">
        {/* Animated Background Array */}
        <div className="absolute inset-0 -z-10 overflow-hidden bg-black">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 2 }}
            className="absolute inset-0"
          >
            <Image
              src="/stock/processed/abstract-dark-texture-01-hero.webp"
              alt=""
              aria-hidden
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/95 mix-blend-multiply" />
          </motion.div>

          {/* Floating Gradients */}
          <motion.div
            animate={{
              x: ["-10%", "10%", "-10%"],
              y: ["-10%", "10%", "-10%"],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full bg-primary/20 blur-[120px] mix-blend-screen opacity-60"
          />
          <motion.div
            animate={{
              x: ["10%", "-10%", "10%"],
              y: ["10%", "-10%", "10%"],
              scale: [1.2, 1, 1.2]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-1/4 -right-1/4 w-[50vw] h-[50vw] rounded-full bg-purple-600/20 blur-[100px] mix-blend-screen opacity-50"
          />
        </div>

        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-8 py-10 sm:py-14 relative z-10">
          <motion.header
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="flex items-center justify-between mb-10 sm:mb-20"
          >
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}>
                <Logo variant="lockup" size={36} className="h-8 text-primary drop-shadow-[0_0_10px_rgba(255,122,24,0.5)]" />
              </motion.div>
            </Link>
            <div className="flex items-center gap-4">
              <LanguageSwitcher variant="compact" />
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-sm font-medium text-white/50">{t("noAccount")}</span>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button asChild size="sm" className="rounded-xl bg-white/10 text-white backdrop-blur-md border border-white/20 hover:bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                    <Link href={registerHref} className="flex gap-2 items-center">
                      {t("signUp")} <ArrowRight className="w-3 h-3" />
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.header>

          <main id="main-content" className="grid gap-8 lg:gap-16 lg:grid-cols-2 items-center">

            {/* Left Column: Form */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="w-full max-w-[420px] mx-auto lg:mx-0"
            >
              <motion.div variants={fadeInUp} className="mb-8">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-white mb-2">{t("welcomeBackTitle")}</h1>
                <p className="text-lg text-white/60">{t("signInDesc")}</p>
              </motion.div>

              <motion.div variants={fadeInUp}>
                <Card className="w-full bg-white/5 backdrop-blur-3xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/50 opacity-50 pointer-events-none" />

                  <form onSubmit={onSubmit} noValidate aria-busy={isLoading || oauthLoading !== null} className="relative z-10 p-6 sm:p-8">
                    <div className="space-y-5">
                      {hasOAuth && (
                        <div className="space-y-3">
                          {providers?.google && (
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 rounded-2xl border-white/20 bg-white/5 backdrop-blur hover:bg-white/10 text-white font-medium transition-all"
                                disabled={isLoading || oauthLoading !== null}
                                onClick={() => onOAuth("google")}
                              >
                                {oauthLoading === "google" ? (
                                  <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Continue with Google</>
                                ) : (
                                  <><Chrome className="mr-3 h-5 w-5" /> Continue with Google</>
                                )}
                              </Button>
                            </motion.div>
                          )}
                          {providers?.apple && (
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 rounded-2xl border-white/20 bg-white/5 backdrop-blur hover:bg-white/10 text-white font-medium transition-all"
                                disabled={isLoading || oauthLoading !== null}
                                onClick={() => onOAuth("apple")}
                              >
                                {oauthLoading === "apple" ? (
                                  <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Continue with Apple</>
                                ) : (
                                  <><Apple className="mr-3 h-5 w-5" /> Continue with Apple</>
                                )}
                              </Button>
                            </motion.div>
                          )}

                          <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center">
                              <span className="bg-[#0a0a0a] px-3 text-[10px] font-bold uppercase tracking-widest text-white/40 rounded-full">
                                Or continue with email
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="space-y-1.5 focus-within:text-primary transition-colors">
                          <Label htmlFor="email" className="text-xs font-semibold text-white/70 tracking-wide uppercase">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder={t("emailPlaceholder")}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            inputMode="email"
                            spellCheck={false}
                            required
                            disabled={isLoading}
                            className="h-12 rounded-xl bg-black/40 border-white/10 focus-visible:ring-primary/50 focus-visible:border-primary text-white placeholder:text-white/30 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-1.5 focus-within:text-primary transition-colors">
                          <Label htmlFor="password" className="text-xs font-semibold text-white/70 tracking-wide uppercase">Password</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            enterKeyHint="go"
                            required
                            disabled={isLoading}
                            className="h-12 rounded-xl bg-black/40 border-white/10 focus-visible:ring-primary/50 focus-visible:border-primary text-white placeholder:text-white/30 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
                        <Button type="submit" className="w-full rounded-xl h-12 shadow-[0_0_20px_rgba(255,122,24,0.3)] bg-primary text-primary-foreground font-bold tracking-wide text-md hover:bg-primary/90 transition-all" disabled={isLoading}>
                          {isLoading ? (
                            <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> {t("signingIn")}</>
                          ) : (
                            t("signIn")
                          )}
                        </Button>
                      </motion.div>
                    </div>
                  </form>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp} className="mt-8 sm:hidden flex flex-col items-center gap-4">
                <p className="text-sm text-white/50">{t("noAccount")}</p>
                <Button asChild variant="outline" className="rounded-xl w-full border-white/20 bg-white/5 text-white">
                  <Link href={registerHref}>{t("signUp")}</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Right Column: Visual Splendor */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="hidden lg:block relative h-[600px] w-full rounded-[3rem] border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden group"
            >
              {/* Internal glowing blob */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/40 rounded-full blur-[80px] group-hover:bg-purple-500/40 transition-colors duration-1000" />

              <div className="absolute inset-0">
                <Image
                  src="/stock/processed/runner-silhouette-sunset-01-hero.webp"
                  alt=""
                  aria-hidden
                  fill
                  sizes="50vw"
                  className="object-cover opacity-60 mix-blend-overlay group-hover:scale-105 transition-transform duration-[10s] ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              </div>

              <div className="relative h-full flex flex-col justify-end p-12 z-10">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <p className="text-xs font-black tracking-[0.2em] text-primary uppercase mb-4 drop-shadow-md">AdaptivAI</p>
                  <h2 className="text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
                    Your plan adapts. <br /> So you can fly.
                  </h2>
                  <p className="text-lg text-white/70 max-w-sm mb-8 font-light">
                    Join thousands of athletes training smarter with AI that understands human fatigue.
                  </p>

                  <div className="flex gap-4 items-center">
                    <div className="flex -space-x-4">
                      <div className="w-10 h-10 rounded-full border-2 border-black bg-gradient-to-br from-blue-400 to-indigo-600" />
                      <div className="w-10 h-10 rounded-full border-2 border-black bg-gradient-to-br from-pink-400 to-rose-600" />
                      <div className="w-10 h-10 rounded-full border-2 border-black bg-gradient-to-br from-emerald-400 to-cyan-600" />
                    </div>
                    <div className="text-sm font-medium text-white/80">
                      Join the movement
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

          </main>
        </div>
      </div>
    </div>
  );
}
