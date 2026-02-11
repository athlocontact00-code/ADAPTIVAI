import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const MAX_W = "max-w-6xl";

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
        <path d="M12 56 L32 12 L52 56" strokeWidth="6" />
        <path d="M19.27 40 L29 40 L32 33 L35 40 L44.73 40" strokeWidth="5" />
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

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
  { href: "/account/delete", label: "Account deletion" },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl safe-area-top">
        <Container className="flex h-14 sm:h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Mark className="text-foreground/90" />
            <span className="text-sm font-semibold tracking-tight">AdaptivAI</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl shadow-soft">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </Container>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-80"
            aria-hidden
            style={{
              background:
                "radial-gradient(700px circle at 20% 10%, rgba(255,122,24,.14), transparent 60%), radial-gradient(900px circle at 80% 0%, rgba(168,85,247,.12), transparent 65%), radial-gradient(900px circle at 50% 100%, rgba(30,58,138,.16), transparent 60%)",
            }}
          />

          <Container className="py-20 sm:py-28 md:py-32">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" aria-hidden />
                Early access • start free
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl text-balance">
                Train smarter. Recover better. Race stronger.
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-muted-foreground text-pretty">
                Adaptive training plans that respond to your fatigue, schedule, and goals — without the clutter.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center">
                <Button asChild size="lg" className="h-12 rounded-2xl px-8 shadow-soft">
                  <Link href="/register">Start free</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-2xl px-8">
                  <Link href="/install">Install as app (PWA)</Link>
                </Button>
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                Built for triathletes, swimmers &amp; endurance athletes.
              </p>
            </div>
          </Container>
        </section>

        {/* Benefits */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Everything you need — nothing you don’t</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              A focused training workflow that looks and feels like the app.
            </p>

            <div className="mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <Card
                  key={b.title}
                  className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card hover:bg-white/5 transition-colors"
                >
                  <div className="p-6">
                    <div className="text-sm font-semibold">{b.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.body}</p>
                  </div>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section className="border-t border-border/40" id="how-it-works">
          <Container className="py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl">Check‑in → Coach → Calendar. Simple.</p>

            <div className="mt-10 grid gap-4 sm:gap-6 sm:grid-cols-3">
              {[
                { n: "01", title: "Check‑in", body: "Quick daily input: sleep, energy, stress, time." },
                { n: "02", title: "Coach", body: "Get an intensity recommendation and a plan for today." },
                { n: "03", title: "Calendar", body: "Keep your week realistic — and adjust without breaking it." },
              ].map((s) => (
                <Card key={s.n} className="bg-card/35 backdrop-blur-md border-white/10 shadow-soft">
                  <div className="p-6">
                    <div className="text-xs text-muted-foreground">{s.n}</div>
                    <div className="mt-2 text-sm font-semibold">{s.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        {/* Pricing */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Pricing</h2>
              <p className="text-muted-foreground max-w-2xl">Free trial. Cancel anytime. Two simple options.</p>
            </div>

            <div className="mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2">
              <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft">
                <div className="p-7">
                  <div className="text-sm font-semibold">Monthly</div>
                  <p className="mt-2 text-sm text-muted-foreground">Billed monthly. Start with a free trial.</p>
                  <div className="mt-6">
                    <Button asChild className="w-full rounded-2xl h-11 shadow-soft">
                      <Link href="/register">Start free trial</Link>
                    </Button>
                  </div>
                </div>
              </Card>
              <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft">
                <div className="p-7">
                  <div className="text-sm font-semibold">Yearly</div>
                  <p className="mt-2 text-sm text-muted-foreground">Billed annually. Start with a free trial.</p>
                  <div className="mt-6">
                    <Button asChild variant="outline" className="w-full rounded-2xl h-11">
                      <Link href="/register">Start free trial</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="mt-6 bg-card/30 backdrop-blur-md border-white/10 shadow-soft">
              <div className="p-7">
                <div className="text-sm font-semibold">What Pro includes</div>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                  {PRO_BULLETS.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1 w-1 rounded-full bg-white/40" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </Container>
        </section>

        {/* FAQ */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">FAQ</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl">Short answers to the common questions.</p>

            <div className="mt-10 max-w-3xl space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-5 sm:p-6 shadow-soft"
                >
                  <summary className="cursor-pointer list-none select-none flex items-start justify-between gap-6">
                    <span className="text-sm font-medium">{item.q}</span>
                    <span className="mt-0.5 text-white/50 transition-transform duration-200 group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-card overflow-hidden">
              <div
                className="pointer-events-none opacity-70"
                aria-hidden
                style={{
                  background:
                    "radial-gradient(700px circle at 20% 20%, rgba(255,122,24,.16), transparent 60%), radial-gradient(900px circle at 90% 10%, rgba(168,85,247,.12), transparent 65%)",
                }}
              />
              <div className="p-8 sm:p-10">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Start free</h2>
                <p className="mt-3 text-muted-foreground max-w-xl">
                  Join early access. No credit card required.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" className="h-12 rounded-2xl px-8 shadow-soft">
                    <Link href="/register">Start free</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-2xl px-8">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t border-border/40 py-10 safe-area-inset-bottom">
        <Container className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mark className="text-muted-foreground" />
            <span>AdaptivAI</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground underline-offset-4 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        </Container>
        <Container className="pt-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} AdaptivAI. All rights reserved.</p>
        </Container>
      </footer>
    </div>
  );
}

