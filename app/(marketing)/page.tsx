import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Calendar,
  BookOpen,
  TrendingUp,
  Bot,
  ClipboardCheck,
  ChevronDown,
  Smartphone,
} from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const HERO_HEADLINE = "Train smarter. Recover better. Race stronger.";
const HERO_SUB =
  "AI-powered planning, check-ins, and analytics for triathletes and endurance athletes.";

const VALUE_PROPS = [
  {
    icon: Bot,
    title: "AI Coach",
    description: "Calendar-ready plans. Ask for today's workout, add sessions, adapt the week.",
  },
  {
    icon: ClipboardCheck,
    title: "Check-in & readiness",
    description: "Daily check-in and a clear recommendation: go hard, go light, or rest.",
  },
  {
    icon: Calendar,
    title: "Calendar & planning",
    description: "Week and month views with load and readiness at a glance.",
  },
  {
    icon: TrendingUp,
    title: "Progress & insights",
    description: "CTL, ATL, TSB and narrative insights. See how you're trending.",
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: "Check-in", body: "Answer a few questions about how you feel." },
  { step: 2, title: "Coach", body: "Get a recommendation and generate or adjust your plan." },
  { step: 3, title: "Execute & review", body: "Log workouts, track progress, and refine over time." },
];

const FAQ = [
  {
    q: "Is this for beginners?",
    a: "Yes. AdaptivAI works at any level. The AI adapts to your experience and goals.",
  },
  {
    q: "Can I use it for one sport only?",
    a: "Yes. Focus on run, bike, swim, or strength—or mix them.",
  },
  {
    q: "Do I need wearables?",
    a: "No. You can log TSS, duration, and RPE manually. Wearables can improve accuracy.",
  },
  {
    q: "How does Pro work?",
    a: "Pro unlocks the full AI Coach and premium features. Monthly or yearly; cancel anytime.",
  },
  {
    q: "What about privacy?",
    a: "Your data stays yours. We don't sell it. See Privacy and Account deletion for details.",
  },
];

const MAX_CONTENT = "max-w-[1200px]";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header: glass, minimal */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl safe-area-top">
        <div className={cn("mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6", MAX_CONTENT)}>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="text-xl font-semibold tracking-tight">AdaptivAI</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="sm:size-default rounded-xl">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="sm:size-default rounded-xl">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* 1. Hero */}
        <section className="px-4 sm:px-6 py-20 sm:py-28 md:py-36">
          <div className={cn("mx-auto text-center", MAX_CONTENT)}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-balance">
              {HERO_HEADLINE}
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
              {HERO_SUB}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto rounded-2xl h-12 px-8 gap-2 shadow-soft">
                  <Zap className="h-4 w-4" />
                  Start free trial
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-2xl h-12 px-8 gap-2">
                  See how it works
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* 2. Value props (cards with glass) */}
        <section className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/40">
          <div className={cn("mx-auto", MAX_CONTENT)}>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Built for endurance</h2>
            <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
              One place for planning, check-ins, and progress.
            </p>
            <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2">
              {VALUE_PROPS.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 sm:p-8 shadow-soft transition-shadow hover:shadow-card"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Screenshots / UI preview */}
        <section className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/40">
          <div className={cn("mx-auto", MAX_CONTENT)}>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">See it in action</h2>
            <p className="text-muted-foreground text-center mb-12">Dashboard, calendar, and AI Coach.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {["Dashboard", "Calendar", "AI Coach"].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border/50 bg-card/40 aspect-[4/3] flex items-center justify-center shadow-soft"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Smartphone className="h-10 w-10 opacity-60" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. How it works */}
        <section id="how-it-works" className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/40">
          <div className={cn("mx-auto", MAX_CONTENT)}>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">How it works</h2>
            <div className="grid gap-10 sm:grid-cols-3 max-w-4xl mx-auto">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-semibold text-sm">
                    {item.step}
                  </div>
                  <h3 className="mt-4 font-semibold text-lg">{item.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Pricing teaser */}
        <section className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/40">
          <div className={cn("mx-auto max-w-2xl text-center", MAX_CONTENT)}>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Simple pricing</h2>
            <p className="text-muted-foreground mb-8">
              Pro is available monthly or yearly. Start a free trial, then manage your subscription in Settings.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="rounded-2xl border border-border/50 bg-card/40 px-8 py-5 min-w-[160px] shadow-soft">
                <div className="font-semibold">Monthly</div>
                <div className="text-sm text-muted-foreground mt-0.5">Billed monthly</div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card/40 px-8 py-5 min-w-[160px] shadow-soft">
                <div className="font-semibold">Yearly</div>
                <div className="text-sm text-muted-foreground mt-0.5">Billed annually</div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FAQ */}
        <section className="px-4 sm:px-6 py-20 sm:py-28 border-t border-border/40">
          <div className={cn("mx-auto", MAX_CONTENT)}>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">FAQ</h2>
            <div className="max-w-2xl mx-auto space-y-8">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <h3 className="font-semibold text-base">{item.q}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Final CTA */}
        <section className="border-t border-border/40 bg-muted/20 py-20 sm:py-28">
          <div className={cn("mx-auto px-4 sm:px-6 text-center", MAX_CONTENT)}>
            <h2 className="text-2xl sm:text-3xl font-bold">Start free</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              No credit card required. Use in the browser or install as an app (PWA) on your phone.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="rounded-2xl h-12 px-8">Start free trial</Button>
              </Link>
              <Link href="/install">
                <Button size="lg" variant="outline" className="rounded-2xl h-12 px-8">
                  Install as app (PWA)
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LegalFooter className="border-t border-border/40 py-12 safe-area-inset-bottom" />
    </div>
  );
}
