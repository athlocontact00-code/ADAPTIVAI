"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  Brain, 
  Calendar, 
  TrendingUp, 
  Heart,
  CheckCircle,
  XCircle,
  Star,
  ArrowRight,
  Instagram,
  Twitter,
  Zap
} from "lucide-react";

import { CheckinMockup, CoachMockup, CalendarMockup } from "./components/app-mockup";
import { AnimatedBg } from "./components/animated-bg";
import { StatsCounter } from "./components/stats-counter";

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
    icon: Brain,
  },
  {
    title: "Daily check‑in & readiness",
    body: "A quick check‑in gives you a clear intensity recommendation: go hard, go easy, or rest.",
    icon: Heart,
  },
  {
    title: "Progress trends + narrative",
    body: "CTL/ATL/TSB plus a simple explanation of what's changing and why it matters.",
    icon: TrendingUp,
  },
  {
    title: "Diary feedback loop",
    body: "Mood, energy, sleep and soreness feed back into planning for better, more realistic weeks.",
    icon: Calendar,
  },
];

const TESTIMONIALS = [
  {
    quote: "Finally, a training platform that actually understands recovery. My coach couldn't believe how much my consistency improved.",
    name: "Sarah Chen",
    sport: "Triathlete",
    rating: 5,
    avatar: "SC"
  },
  {
    quote: "The AI coach suggestions are spot-on. It's like having a personal trainer who knows exactly when to push and when to back off.",
    name: "Mike Rodriguez", 
    sport: "Marathon Runner",
    rating: 5,
    avatar: "MR"
  },
  {
    quote: "Best investment in my training. The readiness score alone has prevented multiple overuse injuries.",
    name: "Emma Thompson",
    sport: "Cyclist", 
    rating: 5,
    avatar: "ET"
  },
];

const COMPARISON_FEATURES = [
  { feature: "AI Coach", adaptivai: true, trainingpeaks: false, strava: false },
  { feature: "Daily Check-in", adaptivai: true, trainingpeaks: false, strava: false },
  { feature: "Readiness Score", adaptivai: true, trainingpeaks: false, strava: false },
  { feature: "Calendar Integration", adaptivai: true, trainingpeaks: true, strava: false },
  { feature: "Workout Builder", adaptivai: true, trainingpeaks: true, strava: false },
  { feature: "Social Features", adaptivai: false, trainingpeaks: false, strava: true },
  { feature: "Price/month", adaptivai: "$9.99", trainingpeaks: "$19.95", strava: "$11.99" },
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
    a: "Privacy‑first. Your data stays yours — we don't sell it.",
  },
];

const PRO_FEATURES = [
  "Full AI Coach + deeper planning tools",
  "Readiness-aware adjustments and explanations", 
  "Progress trends and narrative insights",
  "Calendar-centric workflow",
  "Advanced analytics & reports",
  "Priority support",
];

const FREE_FEATURES = [
  "Dashboard with key metrics",
  "Training calendar",
  "Daily check-in & readiness",
  "Training diary (10 entries/mo)",
  "Getting started guide",
];

const FOOTER_LINKS = {
  product: [
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/install", label: "Install App" },
    { href: "/support", label: "Support" },
  ],
  legal: [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/account/delete", label: "Account Deletion" },
  ],
  connect: [
    { href: "https://instagram.com/adaptivai", label: "Instagram", icon: Instagram },
    { href: "https://twitter.com/adaptivai", label: "Twitter", icon: Twitter },
  ],
} as const;

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
          <AnimatedBg />
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-80"
            aria-hidden
            style={{
              background:
                "radial-gradient(700px circle at 20% 10%, rgba(255,122,24,.14), transparent 60%), radial-gradient(900px circle at 80% 0%, rgba(168,85,247,.12), transparent 65%), radial-gradient(900px circle at 50% 100%, rgba(30,58,138,.16), transparent 60%)",
            }}
          />

          <Container className="py-20 sm:py-28 md:py-32">
            <motion.div 
              className="max-w-3xl"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.p 
                className="inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" aria-hidden />
                Early access • start free
              </motion.p>
              
              <motion.h1 
                className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl text-balance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
              >
                Train smarter. Recover better. Race stronger.
              </motion.h1>
              
              <motion.p 
                className="mt-5 text-lg sm:text-xl text-muted-foreground text-pretty max-w-2xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
              >
                Adaptive training plans that respond to your fatigue, schedule, and goals — without the clutter.
              </motion.p>

              <motion.div 
                className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              >
                <Button asChild size="lg" className="h-12 rounded-2xl px-8 shadow-soft">
                  <Link href="/register">Start free</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-2xl px-8">
                  <Link href="#demo">Watch Demo</Link>
                </Button>
              </motion.div>

              <motion.p 
                className="mt-6 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                No credit card required • Cancel anytime
              </motion.p>
            </motion.div>

            {/* Dashboard Mockup */}
            <motion.div 
              className="mt-16 sm:mt-20"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
            >
              <div className="flex justify-center">
                <CheckinMockup />
              </div>
            </motion.div>
          </Container>
        </section>

        {/* Social Proof Bar */}
        <section className="border-t border-border/40 bg-background/50 backdrop-blur-sm">
          <Container className="py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Trusted by 500+ athletes</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="ml-1 text-sm text-muted-foreground">5.0</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs font-medium text-orange-400">
                  Featured on ProductHunt
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* App Preview Section */}
        <section className="border-t border-border/40" id="demo">
          <Container className="py-16 sm:py-20">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">See it in action</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Experience the three core features that make AdaptivAI different
              </p>
            </motion.div>

            <div className="grid gap-8 md:grid-cols-3">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">Daily Check-in</h3>
                  <p className="text-sm text-muted-foreground">Track readiness, mood, and sleep</p>
                </div>
                <CheckinMockup />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">AI Coach</h3>
                  <p className="text-sm text-muted-foreground">Smart recommendations based on your data</p>
                </div>
                <CoachMockup />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold mb-2">Training Calendar</h3>
                  <p className="text-sm text-muted-foreground">Week view with adaptive planning</p>
                </div>
                <CalendarMockup />
              </motion.div>
            </div>
          </Container>
        </section>

        {/* Features Section */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Everything you need — nothing you don't</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                A focused training workflow that looks and feels like the app.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2">
              {BENEFITS.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card hover:bg-white/5 transition-all duration-300 group">
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                          <benefit.icon className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="text-sm font-semibold">{benefit.title}</div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{benefit.body}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section className="border-t border-border/40" id="how-it-works">
          <Container className="py-16 sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">Check‑in → Coach → Calendar. Simple.</p>
            </motion.div>

            <div className="mt-10 relative">
              {/* Connecting lines */}
              <div className="hidden sm:block absolute top-20 left-1/2 w-full -translate-x-1/2">
                <svg className="w-full h-8" viewBox="0 0 800 32" fill="none">
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgb(249 115 22)" stopOpacity="0.3" />
                      <stop offset="50%" stopColor="rgb(168 85 247)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="rgb(249 115 22)" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  <path d="M100 16 L700 16" stroke="url(#gradient)" strokeWidth="2" strokeDasharray="8 4" />
                  <circle cx="100" cy="16" r="4" fill="rgb(249 115 22)" />
                  <circle cx="400" cy="16" r="4" fill="rgb(168 85 247)" />
                  <circle cx="700" cy="16" r="4" fill="rgb(249 115 22)" />
                </svg>
              </div>

              <div className="grid gap-4 sm:gap-6 sm:grid-cols-3">
                {[
                  { 
                    n: "01", 
                    title: "Check‑in", 
                    body: "Quick daily input: sleep, energy, stress, time.",
                    icon: Heart,
                    color: "orange"
                  },
                  { 
                    n: "02", 
                    title: "Coach", 
                    body: "Get an intensity recommendation and a plan for today.",
                    icon: Brain,
                    color: "purple"
                  },
                  { 
                    n: "03", 
                    title: "Calendar", 
                    body: "Keep your week realistic — and adjust without breaking it.",
                    icon: Calendar,
                    color: "orange"
                  },
                ].map((step, index) => (
                  <motion.div
                    key={step.n}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, duration: 0.6 }}
                    viewport={{ once: true }}
                  >
                    <Card className="bg-card/35 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card hover:bg-white/5 transition-all duration-300 group">
                      <div className="p-6 text-center">
                        <div className={cn(
                          "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform",
                          step.color === "orange" ? "bg-orange-500/10 group-hover:bg-orange-500/20" : "bg-purple-500/10 group-hover:bg-purple-500/20"
                        )}>
                          <step.icon className={cn(
                            "w-8 h-8",
                            step.color === "orange" ? "text-orange-500" : "text-purple-500"
                          )} />
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">{step.n}</div>
                        <div className="text-sm font-semibold mb-2">{step.title}</div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        {/* Stats Counter */}
        <section className="border-t border-border/40 bg-background/50">
          <Container className="py-16 sm:py-20">
            <StatsCounter />
          </Container>
        </section>

        {/* Comparison Table */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Why AdaptivAI?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See how we compare to the competition
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-sm font-semibold">Feature</th>
                        <th className="text-center p-4 text-sm font-semibold bg-orange-500/10">
                          <div className="flex items-center justify-center gap-2">
                            <Mark className="w-4 h-4 text-orange-500" />
                            AdaptivAI
                          </div>
                        </th>
                        <th className="text-center p-4 text-sm font-semibold">TrainingPeaks</th>
                        <th className="text-center p-4 text-sm font-semibold">Strava</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_FEATURES.map((row, index) => (
                        <tr key={row.feature} className="border-b border-white/5 hover:bg-white/2">
                          <td className="p-4 text-sm">{row.feature}</td>
                          <td className="text-center p-4 bg-orange-500/5">
                            {typeof row.adaptivai === 'boolean' ? (
                              row.adaptivai ? (
                                <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-500 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm font-semibold text-orange-400">{row.adaptivai}</span>
                            )}
                          </td>
                          <td className="text-center p-4">
                            {typeof row.trainingpeaks === 'boolean' ? (
                              row.trainingpeaks ? (
                                <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-500 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm text-muted-foreground">{row.trainingpeaks}</span>
                            )}
                          </td>
                          <td className="text-center p-4">
                            {typeof row.strava === 'boolean' ? (
                              row.strava ? (
                                <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-500 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm text-muted-foreground">{row.strava}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </Container>
        </section>

        {/* Testimonials */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">What athletes say</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Join hundreds of athletes who've transformed their training
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((testimonial, index) => (
                <motion.div
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card hover:bg-white/5 transition-all duration-300 h-full">
                    <div className="p-6">
                      <div className="flex mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <blockquote className="text-sm text-muted-foreground leading-relaxed mb-4">
                        "{testimonial.quote}"
                      </blockquote>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">{testimonial.avatar}</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{testimonial.name}</div>
                          <div className="text-xs text-muted-foreground">{testimonial.sport}</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </Container>
        </section>

        {/* Enhanced Pricing */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">Simple, transparent pricing</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Start free, upgrade when you're ready. Cancel anytime.
              </p>
            </motion.div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Free Plan */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft h-full">
                  <div className="p-7">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold mb-2">Free</h3>
                      <div className="text-3xl font-bold mb-1">$0</div>
                      <p className="text-sm text-muted-foreground">Forever</p>
                    </div>
                    
                    <ul className="space-y-3 mb-6">
                      {FREE_FEATURES.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button asChild variant="outline" className="w-full rounded-2xl h-11">
                      <Link href="/register">Get started free</Link>
                    </Button>
                  </div>
                </Card>
              </motion.div>

              {/* Monthly Plan */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Card className="bg-card/40 backdrop-blur-md border-white/10 shadow-soft h-full">
                  <div className="p-7">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold mb-2">Pro Monthly</h3>
                      <div className="text-3xl font-bold mb-1">
                        $9.99<span className="text-base text-muted-foreground font-normal">/mo</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Billed monthly</p>
                    </div>
                    
                    <ul className="space-y-3 mb-6">
                      <li className="text-sm text-muted-foreground mb-2">Everything in Free, plus:</li>
                      {PRO_FEATURES.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button asChild className="w-full rounded-2xl h-11 shadow-soft">
                      <Link href="/register">Start 14-day trial</Link>
                    </Button>
                  </div>
                </Card>
              </motion.div>

              {/* Yearly Plan */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Card className="bg-card/40 backdrop-blur-md border-orange-500/20 shadow-soft h-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                  <div className="p-7">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold mb-2">Pro Yearly</h3>
                      <div className="text-3xl font-bold mb-1">
                        $79.99<span className="text-base text-muted-foreground font-normal">/yr</span>
                      </div>
                      <p className="text-sm text-green-400 font-medium">Save 33% • $6.67/mo</p>
                    </div>
                    
                    <ul className="space-y-3 mb-6">
                      <li className="text-sm text-muted-foreground mb-2">Everything in Pro Monthly, plus:</li>
                      {PRO_FEATURES.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button asChild className="w-full rounded-2xl h-11 shadow-soft bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                      <Link href="/register">Start 14-day trial</Link>
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">FAQ</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">Short answers to the common questions.</p>
            </motion.div>

            <div className="mt-10 max-w-3xl space-y-3">
              {FAQ.map((item, index) => (
                <motion.details
                  key={item.q}
                  className="group rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-5 sm:p-6 shadow-soft hover:shadow-card transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <summary className="cursor-pointer list-none select-none flex items-start justify-between gap-6">
                    <span className="text-sm font-medium">{item.q}</span>
                    <span className="mt-0.5 text-white/50 transition-transform duration-200 group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </motion.details>
              ))}
            </div>
          </Container>
        </section>

        {/* Enhanced Final CTA */}
        <section className="border-t border-border/40">
          <Container className="py-16 sm:py-20">
            <motion.div
              className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-card overflow-hidden relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <AnimatedBg className="rounded-3xl" />
              <div
                className="pointer-events-none opacity-70 absolute inset-0"
                aria-hidden
                style={{
                  background:
                    "radial-gradient(700px circle at 20% 20%, rgba(255,122,24,.16), transparent 60%), radial-gradient(900px circle at 90% 10%, rgba(168,85,247,.12), transparent 65%)",
                }}
              />
              <div className="relative p-8 sm:p-10 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">Join 500+ athletes training smarter</h2>
                  <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                    Start your free trial today. No credit card required.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base shadow-soft">
                      <Link href="/register" className="flex items-center gap-2">
                        Start free trial
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-14 rounded-2xl px-8 text-base">
                      <Link href="/login">Sign in</Link>
                    </Button>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    14-day free trial • No credit card required • Cancel anytime
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </Container>
        </section>
      </main>

      {/* Enhanced Footer */}
      <footer className="border-t border-border/40 py-16 safe-area-inset-bottom">
        <Container>
          <div className="grid gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 text-foreground mb-4">
                <Mark className="text-foreground/90" />
                <span className="text-sm font-semibold tracking-tight">AdaptivAI</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                AI-powered training that adapts to your life.
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Built with ❤️ in Poland 🇵🇱
              </p>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Product</h3>
              <ul className="space-y-3">
                {FOOTER_LINKS.product.map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href} 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Legal</h3>
              <ul className="space-y-3">
                {FOOTER_LINKS.legal.map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href} 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Connect */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Connect</h3>
              <div className="flex gap-4">
                {FOOTER_LINKS.connect.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all duration-200"
                    aria-label={link.label}
                  >
                    <link.icon className="w-5 h-5" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border/40 mt-12 pt-8 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} AdaptivAI. All rights reserved.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}