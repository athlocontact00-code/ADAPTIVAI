"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export type EmptyStateCta =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export function EmptyState({
  title,
  description,
  icon,
  cta,
  size = "md",
  className,
}: {
  title: string;
  description?: string | null;
  icon?: React.ReactNode;
  cta?: EmptyStateCta | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = icon ?? <Sparkles className="h-5 w-5 text-muted-foreground/70" />;

  const padding = size === "sm" ? "py-5" : "py-8";
  const titleCls = size === "sm" ? "text-sm" : "text-sm";
  const descCls = size === "sm" ? "text-xs" : "text-xs";

  const Cta = (() => {
    if (!cta) return null;
    if ("href" in cta) {
      return (
        <Link href={cta.href}>
          <Button size="sm" variant="outline" className="h-8">
            {cta.label}
          </Button>
        </Link>
      );
    }
    return (
      <Button size="sm" variant="outline" className="h-8" onClick={cta.onClick}>
        {cta.label}
      </Button>
    );
  })();

  return (
    <div className={cn("flex h-full w-full items-center justify-center text-center", className)}>
      <div className={cn("max-w-[320px] px-4", padding)}>
        <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-full border border-border/40 bg-muted/20 p-2.5">
          {Icon}
        </div>
        <div className={cn("font-medium text-foreground/90", titleCls)}>{title}</div>
        {description ? (
          <div className={cn("mt-1 leading-relaxed text-muted-foreground/80", descCls)}>{description}</div>
        ) : null}
        {Cta ? <div className="mt-4 flex justify-center">{Cta}</div> : null}
      </div>
    </div>
  );
}

