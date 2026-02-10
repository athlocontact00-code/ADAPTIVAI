import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Calendar,
  BookOpen,
  TrendingUp,
  Shield,
  Bot,
  ClipboardCheck,
  ChevronDown,
  Smartphone,
} from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";
import { Logo } from "@/components/logo";

const HERO_HEADLINE = "Train smarter. Recover better. Race stronger.";
const HERO_SUB =
  "AdaptivAI is built for triathletes, swimmers, and endurance athletes. AI-powered planning, check-ins, and analytics in one place.";

const TRUST_BULLETS = [
  "Built for endurance athletes",
  "AI Coach · Calendar-ready plans",
  "Check-in & readiness",
  "Early access",
];

const FEATURES = [
  {
    icon: Bot,
    title: "AI Coach",
    description: "Generate calendar-ready plans. Ask for today's workout, add swim, plan the week.",
  },
  {
    icon: Calendar,
    title: "Calendar & planning",
    description: "Plan and log workouts. Week and month views with load and readiness at a glance.",
  },
  {
    icon: ClipboardCheck,
    title: "Check-in & readiness",
    description: "Daily check-in and AI recommendation: go hard, go light, or rest.",
  },
  {
    icon: TrendingUp,
    title: "Progress & trends",
    description: "CTL, ATL, TSB, and narrative insights. See how you're trending.",
  },
  {
    icon: BookOpen,
    title: "Diary & feedback",
    description: "Log mood, energy, sleep. Post-workout feedback to refine future plans.",
  },
  {
    icon: Shield,
    title: "Pro",
    description: "Unlock full AI Coach and premium features. Simple subscription, cancel anytime.",
  },
];

const HOW_IT_WORKS = [
  { step: 1, title: "Check-in", body: "Answer a few questions about how you feel." },
  { step: 2, title: "Coach", body: "Get a recommendation and generate or adjust your plan." },
  { step: 3, title: "Calendar", body: "See your week, add sessions, log completion." },
  { step: 4, title: "Review", body: "Track progress and feedback over time." },
];

const FAQ = [
  {
    q: "Is this for beginners?",
    a: "Yes. You can use AdaptivAI at any level. The AI adapts to your experience and goals.",
  },
  {
    q: "Can I use it for swim only?",
    a: "Yes. You can focus on a single discipline (run, bike, swim, strength) or mix them.",
  },
  {
    q: "Do I need wearables?",
    a: "No. You can log TSS, duration, and RPE manually. Wearables can improve accuracy if you use them.",
  },
  {
    q: "How does Pro work?",
    a: "Pro unlocks the full AI Coach and premium features. Subscription is monthly or yearly; you can cancel anytime.",
  },
  {
    q: "What about privacy?",
    a: "Your data stays yours. We don't sell it. See our Privacy Policy and Data deletion page for details.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-top">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-xl font-bold">AdaptivAI</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="sm:size-default">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="sm:size-default">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section id="hero" className="container px-4 sm:px-6 py-16 sm:py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              {HERO_HEADLINE}
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              {HERO_SUB}
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <Zap className="h-4 w-4" />
                  Start free
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                  See how it works
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="mt-12 sm:mt-16 rounded-xl border border-border/60 bg-card/40 p-6 sm:p-8 flex items-center justify-center min-h-[200px]">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Smartphone className="h-12 w-12 opacity-60" />
                <span className="text-sm">App preview</span>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-t border-border/40 py-12 sm:py-16">
          <div className="container px-4 sm:px-6">
            <p className="text-center text-sm font-medium text-muted-foreground mb-6">
              Trusted by endurance athletes
            </p>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
              {TRUST_BULLETS.map((bullet) => (
                <span key={bullet}>{bullet}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">Features</h2>
          <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border/60 bg-card/40 p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border/40 py-16 sm:py-24">
          <div className="container px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">
              How it works
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="text-center">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {item.step}
                  </div>
                  <h3 className="mt-3 font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser (informational only; billing logic unchanged) */}
        <section className="border-t border-border/40 py-16 sm:py-24">
          <div className="container px-4 sm:px-6 max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Simple pricing</h2>
            <p className="text-muted-foreground mb-8">
              Pro is available Monthly or Yearly. Manage your subscription in Settings after you start your free trial.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="rounded-xl border border-border/60 bg-card/40 px-6 py-4 min-w-[140px]">
                <div className="font-semibold">Monthly</div>
                <div className="text-sm text-muted-foreground">Billed monthly</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/40 px-6 py-4 min-w-[140px]">
                <div className="font-semibold">Yearly</div>
                <div className="text-sm text-muted-foreground">Billed annually</div>
              </div>
            </div>
          </div>
        </section>

        {/* Screenshots - TODO: replace placeholder cards with real app screenshots when assets are ready */}
        <section className="container px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">See it in action</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {["Dashboard", "Calendar", "AI Coach"].map((label) => (
              <div
                key={label}
                className="rounded-xl border border-border/60 bg-card/40 aspect-[4/3] flex items-center justify-center"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="container px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">FAQ</h2>
          <div className="max-w-2xl mx-auto space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <h3 className="font-semibold">{item.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border/40 bg-muted/30 py-16 sm:py-24">
          <div className="container px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold">Start free</h2>
            <p className="mt-2 text-muted-foreground">
              No credit card required. Install as app (PWA) on your phone or use in the browser.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register">
                <Button size="lg">Start free</Button>
              </Link>
              <Link href="/install">
                <Button size="lg" variant="outline">Install as app (PWA)</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <LegalFooter className="border-t py-8 safe-area-inset-bottom" />
    </div>
  );
}
