"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  right,
  density = "default",
  className,
}: {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  density?: "default" | "compact";
  className?: string;
}) {
  const pad = density === "compact" ? "mb-2" : "mb-3";

  return (
    <div className={cn("flex items-start justify-between gap-3", pad, className)}>
      <div className="min-w-0">
        <div className="text-sm font-semibold tracking-tight text-foreground">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

