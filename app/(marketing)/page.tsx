import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Activity, Zap, Calendar, BookOpen, TrendingUp, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">AdaptivAI</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="container py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Train Smarter with{" "}
              <span className="text-primary">AI-Powered</span> Insights
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              AdaptivAI combines advanced analytics with intuitive tracking to help
              you optimize your training, recover better, and achieve your goals.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Start 14-Day Free Trial
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="container py-16">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Performance Analytics"
              description="Track your training load, fitness, and fatigue with advanced metrics like CTL, ATL, and TSB."
            />
            <FeatureCard
              icon={<Calendar className="h-6 w-6" />}
              title="Smart Calendar"
              description="Plan and log your workouts with an intuitive calendar. See your training at a glance."
            />
            <FeatureCard
              icon={<BookOpen className="h-6 w-6" />}
              title="Training Diary"
              description="Log how you feel each day. Track mood, energy, sleep, and soreness to optimize recovery."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Readiness Score"
              description="Know when to push hard and when to rest with our AI-calculated readiness score."
            />
            <FeatureCard
              icon={<Activity className="h-6 w-6" />}
              title="Workout Tracking"
              description="Log runs, rides, swims, and strength sessions with detailed metrics and notes."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Privacy First"
              description="Your data stays yours. No third-party sharing, ever."
            />
          </div>
        </section>

        <section className="border-t bg-muted/50 py-16">
          <div className="container text-center">
            <h2 className="text-2xl font-bold">Ready to transform your training?</h2>
            <p className="mt-2 text-muted-foreground">
              Join athletes who train smarter with AdaptivAI.
            </p>
            <div className="mt-6">
              <Link href="/register">
                <Button size="lg">Start 14-Day Free Trial</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              AdaptivAI © {new Date().getFullYear()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for athletes, by athletes.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
