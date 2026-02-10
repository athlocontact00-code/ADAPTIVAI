"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Action =
  | { label: string; href: string; variant?: "default" | "outline" }
  | { label: string; onClick: () => void; variant?: "default" | "outline" };

function ActionButton({ action, size }: { action: Action; size: "default" | "lg" }) {
  const variant = action.variant ?? "default";
  if ("href" in action) {
    return (
      <Link href={action.href} className="w-full sm:w-auto">
        <Button size={size} variant={variant} className="font-medium w-full sm:w-auto">
          {action.label}
        </Button>
      </Link>
    );
  }
  return (
    <Button size={size} variant={variant} onClick={action.onClick} className="font-medium w-full sm:w-auto">
      {action.label}
    </Button>
  );
}

export function ActionCard({
  title,
  subtitle,
  primary,
  secondary,
  badges,
  right,
  children,
  density = "default",
  className,
}: {
  title: string;
  subtitle: string;
  primary: Action;
  secondary?: Action | null;
  badges?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  density?: "default" | "compact";
  className?: string;
}) {
  const pad = density === "compact" ? "p-4" : "p-5";
  const subtitleCls = density === "compact" ? "text-xs" : "text-sm";
  const buttonSize = density === "compact" ? "default" : "lg";

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.035] via-transparent to-transparent pointer-events-none" />
      <div className={cn("relative", pad)}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="text-lg font-semibold tracking-tight truncate">{title}</div>
              {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
            </div>
            <div className={cn("text-muted-foreground/80 max-w-xl leading-relaxed", subtitleCls)}>{subtitle}</div>

            <div
              className={cn(
                "mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center",
                density === "compact" ? "mt-3" : "mt-4"
              )}
            >
              <ActionButton action={primary} size={buttonSize} />
              {secondary ? (
                <ActionButton action={{ ...secondary, variant: secondary.variant ?? "outline" }} size={buttonSize} />
              ) : null}
            </div>

            {children ? <div className={cn("mt-4", density === "compact" ? "mt-3" : "mt-4")}>{children}</div> : null}
          </div>

          {right ? <div className="lg:self-start shrink-0">{right}</div> : null}
        </div>
      </div>
    </Card>
  );
}

