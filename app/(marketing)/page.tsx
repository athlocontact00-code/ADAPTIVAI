import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LegalFooter } from "@/components/legal-footer";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

const MAX_CONTENT = "max-w-[1200px]";

const HERO = {
  headline: "Plan treningowy dopasowany do zmęczenia i grafiku.",
  sub: "Daily check‑in → plan → wyjaśnienie „dlaczego” → alternatywy.",
};

const HOW_IT_WORKS = [
  {
    title: "Check‑in (30s)",
    body: "Krótko: sen, energia, stres i ile masz dziś czasu.",
  },
  {
    title: "Plan na dziś",
    body: "Trening dopasowany do zmęczenia, celu i okienka w kalendarzu.",
  },
  {
    title: "Dlaczego + wersja B",
    body: "Jasne uzasadnienie i alternatywa, gdy dzień się sypie.",
  },
];

const FEATURES = [
  {
    title: "Reschedule bez stresu",
    body: "Przesuń sesję — plan sam układa resztę tygodnia, bez tracenia sensu.",
  },
  {
    title: "Readiness‑aware intensity",
    body: "Dobieramy intensywność do zmęczenia: akcent, lekko albo regeneracja.",
  },
  {
    title: "Wyjaśnienie „dlaczego”",
    body: "Każdy trening ma cel, kontekst i wskazówki wykonania.",
  },
  {
    title: "Tydzień, który ma narrację",
    body: "Widzisz co budujemy teraz i co jest najważniejsze w tym mikrocyklu.",
  },
  {
    title: "Integracje (wkrótce)",
    body: "Strava, Garmin, Apple Health — plus ręczne logowanie bez zegarka.",
  },
  {
    title: "Sztywno tam, gdzie trzeba",
    body: "Kluczowe akcenty są chronione. Reszta jest elastyczna i realistyczna.",
  },
];

const SCREEN_SLOTS = [
  { title: "Daily check‑in", caption: "Zmęczenie • sen • stres • czas" },
  { title: "Plan na dziś", caption: "Trening + alternatywy + „dlaczego”" },
  { title: "Tydzień", caption: "Obciążenie • akcenty • regeneracja" },
  { title: "Insights", caption: "Trendy + krótka narracja" },
  { title: "Coach", caption: "Zapytaj i przeplanuj w 1 rozmowie" },
];

const QUOTES = [
  {
    name: "Early tester",
    quote:
      "W końcu plan, który nie wywraca się, gdy mam gorszy dzień. Lubię wersje alternatywne.",
  },
  {
    name: "Triathlete (beta)",
    quote: "Najlepsze jest „dlaczego” — wiem po co robię akcent i jak go wykonać.",
  },
  {
    name: "Runner (beta)",
    quote: "Check‑in trwa chwilę, a rekomendacja jest zaskakująco trafna. Zero przeładowania.",
  },
];

const FAQ = [
  {
    q: "Dla kogo jest AdaptivAI?",
    a: "Dla biegaczy, kolarzy, pływaków i triathlonistów — od ambitnych amatorów po zaawansowanych. Plan dopasowuje się do celu i dostępnego czasu.",
  },
  {
    q: "Czy muszę mieć zegarek / wearable?",
    a: "Nie. Możesz działać na RPE, czasie i notatkach. Wearables pomagają, ale nie są wymagane.",
  },
  {
    q: "Skąd bierzecie dane?",
    a: "Z check‑inu i Twoich treningów. Integracje (Strava/Garmin/Apple Health) są w roadmapie i będą opcjonalne.",
  },
  {
    q: "Czy plan zmienia się w trakcie tygodnia?",
    a: "Tak — adaptuje się do zmęczenia i kalendarza. Kluczowe jednostki są chronione, a reszta może się przesunąć.",
  },
  {
    q: "Czy mogę trenować tylko jeden sport?",
    a: "Tak. Możesz prowadzić tylko bieg, tylko rower, tylko pływanie lub miksować dyscypliny.",
  },
  {
    q: "Jak wygląda prywatność?",
    a: "Privacy‑first. Nie sprzedajemy danych. Masz kontrolę nad eksportem i usunięciem konta (patrz polityka prywatności).",
  },
  {
    q: "Czy mogę anulować w dowolnym momencie?",
    a: "Tak. W becie dostęp jest bezpłatny. Pro pojawi się później — z możliwością rezygnacji w każdej chwili.",
  },
  {
    q: "Czy to zastąpi trenera?",
    a: "To narzędzie do planowania i decyzji „na dziś”. Jeśli masz trenera, AdaptivAI może być warstwą egzekucji i adaptacji do realnego życia.",
  },
];

function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto px-4 sm:px-6", MAX_CONTENT, className)}>{children}</div>;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 safe-area-top">
        <div className={cn("mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6", MAX_CONTENT)}>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo variant="lockup" size={28} className="h-7" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#how-it-works" className="hover:text-foreground transition-colors">
                How it works
              </a>
              <a href="#features" className="hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#product" className="hover:text-foreground transition-colors">
                Product
              </a>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#faq" className="hover:text-foreground transition-colors">
                FAQ
              </a>
            </nav>
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl shadow-soft">
              <Link href="/register">Join beta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <Image
              src="/stock/processed/runner-goldenhour-01-hero.webp"
              alt=""
              aria-hidden
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/70 to-background" />
            <div className="absolute inset-0 opacity-80 [background:radial-gradient(600px_circle_at_20%_10%,rgba(255,122,24,.18),transparent_60%),radial-gradient(700px_circle_at_80%_0%,rgba(168,85,247,.14),transparent_60%),radial-gradient(900px_circle_at_50%_100%,rgba(30,58,138,.18),transparent_60%)]" />
          </div>

          <Container className="py-20 sm:py-28 md:py-32">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-6">
                <Reveal>
                  <div className="inline-flex items-center gap-2 rounded-pill border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/50" aria-hidden />
                    Beta • early access
                  </div>
                  <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl text-balance">
                    {HERO.headline}
                  </h1>
                  <p className="mt-5 text-lg sm:text-xl text-white/70 max-w-xl text-pretty">
                    {HERO.sub}
                  </p>

                  <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center">
                    <Button asChild size="lg" className="h-12 rounded-2xl px-7 shadow-soft">
                      <Link href="/register">Join beta</Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-2xl px-7 border-white/15 bg-white/0 hover:bg-white/5"
                    >
                      <a href="#demo">Watch demo (20s)</a>
                    </Button>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/65">
                    {["No credit card", "Takes 30 seconds", "Privacy‑first"].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>

              <div className="lg:col-span-6">
                <Reveal delayMs={90} className="relative">
                  <div className="relative mx-auto max-w-[560px] lg:max-w-none">
                    {/* MacBook placeholder */}
                    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-card">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                        <Image
                          src="/stock/processed/abstract-dark-texture-01-section.webp"
                          alt=""
                          aria-hidden
                          fill
                          sizes="(min-width: 1024px) 520px, 92vw"
                          className="object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                        <div className="absolute inset-0 flex items-end p-4">
                          <p className="text-xs text-white/70">MacBook mockup placeholder</p>
                        </div>
                      </div>
                    </div>

                    {/* iPhone placeholder */}
                    <div className="absolute -bottom-10 -left-6 sm:-left-10 w-[220px] sm:w-[240px]">
                      <div className="rounded-[2.25rem] border border-white/10 bg-white/5 backdrop-blur-md p-2 shadow-card">
                        <div className="relative aspect-[9/19] overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                          <Image
                            src="/stock/processed/abstract-warm-bokeh-01-section.webp"
                            alt=""
                            aria-hidden
                            fill
                            sizes="240px"
                            className="object-cover opacity-75"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                          <div className="absolute inset-0 flex items-end p-3">
                            <p className="text-[11px] text-white/70">iPhone mockup placeholder</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </Container>
        </section>

        {/* Trusted by */}
        <section className="border-t border-border/40">
          <Container className="py-12 sm:py-14">
            <Reveal className="text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Trusted by early testers (integrations placeholder)
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {["Strava", "Garmin", "Apple Health"].map((name) => (
                  <div
                    key={name}
                    className="rounded-pill border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </Reveal>
          </Container>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <Reveal className="text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Jak to działa</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Minimalny rytuał rano. Plan na dziś. I zawsze wersja alternatywna.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-3">
              {HOW_IT_WORKS.map((item, idx) => (
                <Reveal key={item.title} delayMs={idx * 60}>
                  <Card className="h-full bg-card/40 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card">
                    <div className="p-6">
                      <div className="text-xs text-white/60">0{idx + 1}</div>
                      <div className="mt-2 text-base font-semibold">{item.title}</div>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <Reveal className="flex flex-col items-center text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Premium minimal, maksymalnie praktyczne
              </h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                Bez fajerwerków. Tylko rzeczy, które realnie ratują tydzień i budują formę.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, idx) => (
                <Reveal key={f.title} delayMs={idx * 40}>
                  <Card className="h-full bg-card/35 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card">
                    <div className="p-6">
                      <div className="text-sm font-semibold">{f.title}</div>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Product / screens */}
        <section id="product" className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <Reveal className="flex flex-col items-center text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Product preview</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                Zostawiamy miejsce na Twoje mockupy iPhone/MacBook. Sekcje są gotowe do podmiany.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {SCREEN_SLOTS.map((s, idx) => (
                <Reveal key={s.title} delayMs={idx * 35}>
                  <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-soft hover:shadow-card transition-shadow">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
                      <Image
                        src="/stock/processed/cyclist-road-sunset-01-section.webp"
                        alt=""
                        aria-hidden
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 48vw, 92vw"
                        className="object-cover opacity-60"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-transparent to-transparent" />
                      <div className="absolute inset-0 flex items-end p-4">
                        <div>
                          <div className="text-sm font-medium">{s.title}</div>
                          <div className="mt-1 text-xs text-white/65">{s.caption}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Placeholder — podmień na mockup w późniejszym etapie.
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Adaptive scheduling (quick win) */}
        <section className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <Reveal>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Adaptive scheduling</p>
                  <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">
                    Plan dopasowuje się do grafiku, nie odwrotnie
                  </h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    Gdy wypadnie spotkanie albo czujesz zmęczenie, nie zaczynasz od zera. Przesuwasz jedną rzecz, a
                    reszta tygodnia układa się automatycznie — bez rozwalania kluczowych akcentów.
                  </p>
                  <div className="mt-7 flex flex-col sm:flex-row gap-3">
                    <Button asChild className="rounded-2xl shadow-soft">
                      <Link href="/register">Get early access</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl border-white/15 bg-white/0 hover:bg-white/5">
                      <a href="#faq">Zobacz FAQ</a>
                    </Button>
                  </div>
                </Reveal>
              </div>

              <div className="lg:col-span-7">
                <Reveal delayMs={90}>
                  <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-card">
                    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10">
                      <Image
                        src="/stock/processed/abstract-warm-bokeh-01-hero.webp"
                        alt=""
                        aria-hidden
                        fill
                        sizes="(min-width: 1024px) 640px, 92vw"
                        className="object-cover opacity-70"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
                      <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-end">
                        <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur px-4 py-3">
                          <div className="text-xs text-white/60">Example</div>
                          <div className="mt-1 text-sm font-medium">„Nie mogę w czwartek — przełóż akcent.”</div>
                          <div className="mt-2 text-xs text-white/65">
                            AdaptivAI przesuwa akcent, chroni regenerację i aktualizuje resztę tygodnia.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </Container>
        </section>

        {/* Demo (quick win) */}
        <section id="demo" className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <Reveal className="flex flex-col items-center text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Demo</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                Placeholder na 20‑sekundowy film. Podmień na realny materiał, gdy będzie gotowy.
              </p>
            </Reveal>

            <Reveal delayMs={80}>
              <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-card">
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src="/stock/processed/cyclist-urban-sunset-01-hero.webp"
                    alt=""
                    aria-hidden
                    fill
                    sizes="(min-width: 1024px) 1100px, 92vw"
                    className="object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-pill border border-white/15 bg-black/30 backdrop-blur px-5 py-2 text-sm text-white/80">
                      Watch demo (20s)
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </Container>
        </section>

        {/* Social proof */}
        <section className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <Reveal className="flex flex-col items-center text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Social proof</p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">30 early testers</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                Cytaty są placeholderami — podmień na realne opinie po pierwszych rozmowach.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((q, idx) => (
                <Reveal key={q.quote} delayMs={idx * 60}>
                  <Card className="h-full bg-card/35 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card">
                    <div className="p-6">
                      <p className="text-sm leading-relaxed text-white/80">“{q.quote}”</p>
                      <p className="mt-4 text-xs text-muted-foreground">{q.name}</p>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <Reveal className="flex flex-col items-center text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Pricing</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">Prosto. W becie skupiamy się na dopasowaniu produktu.</p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-2">
              <Reveal>
                <Card className="h-full bg-card/40 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card">
                  <div className="p-7">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold">Beta access</div>
                      <div className="rounded-pill border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                        Free
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Early access + wszystkie kluczowe elementy planowania.
                    </p>
                    <ul className="mt-6 space-y-2 text-sm text-white/80">
                      {[
                        "Daily check‑in + rekomendacja",
                        "Plan na dziś + alternatywy",
                        "Tydzień + adaptacje",
                        "Privacy‑first",
                      ].map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 h-1 w-1 rounded-full bg-white/40" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      <Button asChild className="w-full rounded-2xl h-11 shadow-soft">
                        <Link href="/register">Join beta</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              </Reveal>

              <Reveal delayMs={70}>
                <Card className="h-full bg-card/25 backdrop-blur-md border-white/10 shadow-soft hover:shadow-card">
                  <div className="p-7">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold">Pro</div>
                      <div className="rounded-pill border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                        Coming soon
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Dla tych, którzy chcą głębszych analiz i automatyzacji.
                    </p>
                    <ul className="mt-6 space-y-2 text-sm text-white/80">
                      {[
                        "Zaawansowane insighty + trendy",
                        "Integracje (Strava/Garmin/Apple Health)",
                        "Więcej modeli planu i periodizacji",
                        "Eksporty i workflow dla trenera",
                      ].map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-2 h-1 w-1 rounded-full bg-white/40" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      <Button disabled className="w-full rounded-2xl h-11">
                        Coming soon
                      </Button>
                    </div>
                  </div>
                </Card>
              </Reveal>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/40">
          <Container className="py-20 sm:py-28">
            <Reveal className="flex flex-col items-center text-center">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">FAQ</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl">
                Najczęstsze pytania o adaptację, dane i prywatność.
              </p>
            </Reveal>

            <div className="mt-12 max-w-3xl mx-auto space-y-3">
              {FAQ.map((item, idx) => (
                <Reveal key={item.q} delayMs={idx * 25}>
                  <details className="group rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-5 sm:p-6 shadow-soft">
                    <summary className="cursor-pointer list-none select-none flex items-start justify-between gap-6">
                      <span className="text-sm font-medium">{item.q}</span>
                      <span
                        className="mt-0.5 text-white/50 transition-transform duration-200 group-open:rotate-45"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="relative border-t border-border/40">
          <div className="absolute inset-0 -z-10">
            <Image
              src="/stock/processed/abstract-warm-bokeh-01-hero.webp"
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              className="object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
          </div>

          <Container className="py-20 sm:py-28 text-center">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dołącz do bety</h2>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Zacznij bez karty. Zobacz jak wygląda plan dopasowany do realnego życia, nie idealnego tygodnia.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild size="lg" className="h-12 rounded-2xl px-8 shadow-soft w-full sm:w-auto">
                  <Link href="/register">Join beta</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-2xl px-8 border-white/15 bg-white/0 hover:bg-white/5 w-full sm:w-auto"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </Reveal>
          </Container>
        </section>
      </main>

      <LegalFooter className="border-t border-border/40 py-12 safe-area-inset-bottom" />
    </div>
  );
}
