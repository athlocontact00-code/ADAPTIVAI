"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { motion, useScroll, useTransform } from "framer-motion";

const MAX_W = "max-w-6xl";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.adaptivai.online";

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6", MAX_W, className)}>{children}</div>;
}

function Mark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("shrink-0", className)}
      width="20"
      height="20"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 54 L32 12 L48 54" strokeWidth="5.5" />
        <path d="M22 40 H27.5 L31.5 33.5 L35 42 H42" strokeWidth="4.5" />
      </g>
    </svg>
  );
}

const BENEFITS = [
  {
    title: "AI planning, calendar-ready",
    body: "Generate structured workouts and weeks you can actually execute — then adapt them when life happens.",
  },
  {
    title: "Daily check‑in & readiness",
    body: "A quick check‑in gives you a clear intensity recommendation: go hard, go easy, or rest.",
  },
  {
    title: "Progress trends + narrative",
    body: "CTL/ATL/TSB plus a simple explanation of what’s changing and why it matters.",
  },
  {
    title: "Diary feedback loop",
    body: "Mood, energy, sleep and soreness feed back into planning for better, more realistic weeks.",
  },
];

const FAQ = [
  {
    q: "Do I need a watch or wearable?",
    a: "No. You can train using time + RPE. Wearables can improve accuracy but are optional.",
  },
  {
    q: "Is this only for triathlon?",
    a: "No. AdaptivAI works for running, cycling and swimming — and you can mix disciplines.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Start free, upgrade later, and cancel anytime.",
  },
  {
    q: "How do you handle privacy?",
    a: "Privacy‑first. Your data stays yours — we don’t sell it.",
  },
];

const PRO_BULLETS = [
  "Full AI Coach + deeper planning tools",
  "Readiness-aware adjustments and explanations",
  "Progress trends and narrative insights",
  "Calendar-centric workflow",
  "Cancel anytime",
];

import { Variants } from "framer-motion";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
  { href: "/account/delete", label: "Account deletion" },
] as const;

// Animation Variants
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

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const yPos = useTransform(scrollYProgress, [0, 1], [0, 300]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-card"
      >
        Skip to content
      </a>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-2xl safe-area-top"
      >
        <Container className="flex h-14 sm:h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground group">
            <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.4 }}>
              <Mark className="text-primary" />
            </motion.div>
            <span className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">AdaptivAI</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="compact" />
            <Button asChild variant="ghost" size="sm" className="rounded-xl hidden sm:flex hover:bg-white/5 transition-colors">
              <Link href="/login">Sign in</Link>
            </Button>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild size="sm" className="rounded-xl shadow-[0_0_20px_rgba(255,122,24,0.3)] bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/register">Get started</Link>
              </Button>
            </motion.div>
          </div>
        </Container>
      </motion.header>

      <main id="main-content">
        {/* Animated Hero Background */}
        <section className="relative overflow-hidden pt-20 pb-32 sm:pt-32 sm:pb-40 lg:pt-40 lg:pb-48">
          <motion.div
            style={{ y: yPos }}
            className="pointer-events-none absolute inset-0 -z-10 opacity-60"
            aria-hidden
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,_rgba(255,122,24,0.2),_transparent_40%),_radial-gradient(circle_at_80%_0%,_rgba(168,85,247,0.15),_transparent_50%),_radial-gradient(circle_at_50%_100%,_rgba(30,58,138,0.2),_transparent_60%)] animate-pulse-slow mix-blend-screen" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
          </motion.div>

          <Container>
            <motion.div
              className="max-w-4xl mx-auto text-center flex flex-col items-center"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} className="mb-6">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs sm:text-sm font-medium text-primary shadow-[0_0_15px_rgba(255,122,24,0.1)] backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Early access • Start Free
                </p>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl text-balance bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-white/50"
              >
                Train smarter.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-600">
                  Recover better.
                </span>
                <br />
                Race stronger.
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="mt-8 text-lg sm:text-xl md:text-2xl text-muted-foreground text-pretty max-w-2xl font-light"
              >
                The only adaptive training app that actually listens to your body. Powered by AI, designed for humans.
              </motion.p>

              <motion.div
                variants={fadeInUp}
                className="mt-10 flex flex-col sm:flex-row gap-4 sm:items-center justify-center w-full max-w-md"
              >
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                  <Button asChild size="lg" className="h-14 w-full rounded-2xl px-10 text-lg font-semibold shadow-[0_0_30px_rgba(255,122,24,0.3)] bg-primary text-primary-foreground">
                    <Link href="/register">Start free trial</Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
                  <Button asChild size="lg" variant="outline" className="h-14 w-full rounded-2xl px-10 text-lg font-medium border-white/20 bg-white/5 backdrop-blur-md hover:bg-white/10">
                    <Link href="/install">Install PWA</Link>
                  </Button>
                </motion.div>
              </motion.div>

              <motion.p variants={fadeInUp} className="mt-8 text-sm font-medium text-white/40 tracking-wide uppercase">
                Built for triathletes, swimmers & endurance athletes
              </motion.p>
            </motion.div>
          </Container>
        </section>

        {/* Benefits Cards Section */}
        <section className="py-20 sm:py-32 relative z-10 border-t border-white/5 bg-black/40">
          <Container>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="text-center mb-16"
            >
              <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                Everything you need
                <br />
                <span className="text-white/40">nothing you don’t</span>
              </motion.h2>
            </motion.div>

            <motion.div
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              {BENEFITS.map((b, i) => (
                <motion.div
                  key={b.title}
                  variants={fadeInUp}
                  whileHover={{ y: -10, scale: 1.02 }}
                  className="group relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-purple-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <Card className="relative h-full bg-white/5 backdrop-blur-xl border-white/10 p-8 rounded-3xl shadow-2xl transition-all duration-300 overflow-hidden">
                    <div className="text-5xl mb-6 opacity-20 font-black absolute -top-4 -right-2 text-white/50 group-hover:text-primary transition-colors">0{i + 1}</div>
                    <h3 className="text-xl font-bold text-white mb-4 relative z-10">{b.title}</h3>
                    <p className="text-muted-foreground leading-relaxed relative z-10">{b.body}</p>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </Container>
        </section>

        {/* Pricing Section - Highly Animated */}
        <section className="py-20 sm:py-32 border-t border-white/5 overflow-hidden relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
          <Container>
            <motion.div
              className="text-center max-w-2xl mx-auto mb-16 relative z-10"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Simple Pricing</h2>
              <p className="mt-4 text-xl text-muted-foreground">Free trial. Cancel anytime.</p>
            </motion.div>

            <motion.div
              className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto relative z-10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} whileHover={{ scale: 1.03 }}>
                <Card className="bg-white/5 backdrop-blur-2xl border-white/10 p-10 rounded-[2.5rem] shadow-2xl h-full flex flex-col">
                  <h3 className="text-2xl font-bold">Monthly</h3>
                  <p className="mt-2 text-muted-foreground flex-grow">Billed monthly. Ultimate flexibility.</p>
                  <Button asChild size="lg" className="mt-8 rounded-2xl w-full h-14 text-lg">
                    <Link href="/register">Start free trial</Link>
                  </Button>
                </Card>
              </motion.div>

              <motion.div variants={fadeInUp} whileHover={{ scale: 1.03 }}>
                <Card className="bg-gradient-to-b from-primary/20 via-primary/5 to-white/5 backdrop-blur-2xl border-primary/30 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(255,122,24,0.15)] h-full flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-bl-2xl">POPULAR</div>
                  <h3 className="text-2xl font-bold text-white">Yearly</h3>
                  <p className="mt-2 text-white/70 flex-grow">Save long-term. Commit to your goals.</p>
                  <Button asChild size="lg" className="mt-8 rounded-2xl w-full h-14 bg-primary text-white hover:bg-primary/90 text-lg shadow-[0_0_20px_rgba(255,122,24,0.4)]">
                    <Link href="/register">Start free trial</Link>
                  </Button>
                </Card>
              </motion.div>
            </motion.div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-20 sm:py-32 relative">
          <Container>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="rounded-[3rem] bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-3xl border border-white/20 p-12 sm:p-20 text-center relative overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,122,24,0.3)_0%,_transparent_70%)] opacity-50 mix-blend-screen" />

              <div className="relative z-10 max-w-3xl mx-auto">
                <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-white">
                  Ready to transform your training?
                </h2>
                <p className="mt-6 text-xl text-white/70">
                  Join early access today. No credit card required.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button asChild size="lg" className="h-14 rounded-2xl px-10 text-lg font-bold shadow-[0_0_30px_rgba(255,122,24,0.4)] bg-primary text-white">
                      <Link href="/register">Start for free</Link>
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-white/10 pt-16 pb-8 bg-black">
        <Container className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-white/50">
            <Mark className="opacity-50" />
            <span className="font-semibold tracking-wide">AdaptivAI</span>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-medium text-white/50">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
        </Container>
        <Container className="pt-8 mt-8 border-t border-white/5 text-center sm:text-left">
          <p className="text-xs text-white/30 tracking-wider uppercase font-medium">© {new Date().getFullYear()} AdaptivAI. All rights reserved.</p>
        </Container>
      </footer>
    </div>
  );
}
