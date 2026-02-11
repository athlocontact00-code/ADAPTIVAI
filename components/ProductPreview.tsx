import Image from "next/image";
import { cn } from "@/lib/utils";

type DeviceLabel = "Mobile" | "Desktop";

function Badge({ label }: { label: DeviceLabel }) {
  return (
    <div className="absolute right-3 top-3 z-10">
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/80 backdrop-blur">
        {label}
      </span>
    </div>
  );
}

function ScreenshotCard({
  src,
  alt,
  label,
  aspectClass,
  className,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  label: DeviceLabel;
  aspectClass: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-soft transition-all duration-200",
        "hover:border-white/20 hover:bg-white/[0.06] hover:shadow-card hover:scale-[1.01]",
        className
      )}
    >
      {/* Subtle premium frame/gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent opacity-60 transition-opacity duration-200 group-hover:opacity-80" />
      <Badge label={label} />

      <div className={cn("relative", aspectClass)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover transition duration-200 group-hover:brightness-[1.03]"
        />
      </div>
    </div>
  );
}

function ProductRow({
  title,
  description,
  mobile,
  desktop,
}: {
  title: string;
  description: string;
  mobile: { src: string; alt: string };
  desktop: { src: string; alt: string };
}) {
  return (
    <div className="pt-12 first:pt-0">
      <div className="mb-6">
        <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-start">
        {/* On mobile: Desktop first, then Mobile */}
        <ScreenshotCard
          src={desktop.src}
          alt={desktop.alt}
          label="Desktop"
          aspectClass="aspect-[16/10]"
          sizes="(max-width: 768px) 100vw, 60vw"
          className="order-1 md:order-2"
        />
        <ScreenshotCard
          src={mobile.src}
          alt={mobile.alt}
          label="Mobile"
          aspectClass="aspect-[9/19.5]"
          sizes="(max-width: 768px) 100vw, 40vw"
          className="order-2 md:order-1 md:self-start"
        />
      </div>
    </div>
  );
}

export function ProductPreview() {
  return (
    <section
      id="product"
      className="scroll-mt-24 px-4 sm:px-6 py-20 sm:py-24 border-t border-border/40"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Product preview</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Mobile and desktop views of the core workflow.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-card/30 backdrop-blur-sm p-6 sm:p-8 shadow-soft">
          <ProductRow
            title="Dashboard"
            description="Today’s next action, check-ins, and readiness at a glance."
            mobile={{
              src: "/screens/dashboard-mobile.jpg",
              alt: "Dashboard mobile preview",
            }}
            desktop={{
              src: "/screens/dashboard-desktop.png",
              alt: "Dashboard desktop preview",
            }}
          />

          <div className="mt-12 border-t border-white/10" />

          <ProductRow
            title="AI Coach"
            description="A focused chat-first assistant. Actions live in one place."
            mobile={{
              src: "/screens/coach-mobile.jpg",
              alt: "AI Coach mobile preview",
            }}
            desktop={{
              src: "/screens/coach-desktop.png",
              alt: "AI Coach desktop preview",
            }}
          />

          <div className="mt-12 border-t border-white/10" />

          <ProductRow
            title="Calendar"
            description="Day/Week views built for training, not tiny month grids."
            mobile={{
              src: "/screens/calendar-mobile.jpg",
              alt: "Calendar mobile preview",
            }}
            desktop={{
              src: "/screens/calendar-desktop.png",
              alt: "Calendar desktop preview",
            }}
          />
        </div>
      </div>
    </section>
  );
}

