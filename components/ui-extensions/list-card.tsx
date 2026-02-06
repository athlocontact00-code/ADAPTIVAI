"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState, type EmptyStateCta } from "./empty-state";
import { SectionHeader } from "./section-header";

export function ListCard<T>({
  title,
  subtitle,
  right,
  items,
  renderItem,
  empty,
  density = "default",
  className,
}: {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  empty: {
    title: string;
    description?: string | null;
    cta?: EmptyStateCta | null;
    icon?: React.ReactNode;
  };
  density?: "default" | "compact";
  className?: string;
}) {
  const pad = density === "compact" ? "p-4" : "p-5";
  const itemGap = density === "compact" ? "py-2" : "py-2.5";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className={pad}>
        <SectionHeader title={title} subtitle={subtitle} right={right} density={density} className="mb-0" />
      </div>
      <Separator className="bg-border/40" />
      <div className={cn(density === "compact" ? "px-4" : "px-5")}>
        {items.length === 0 ? (
          <div className={cn("min-h-[160px]", density === "compact" ? "py-2" : "py-4")}>
            <EmptyState
              title={empty.title}
              description={empty.description ?? undefined}
              cta={empty.cta ?? undefined}
              icon={empty.icon}
              size={density === "compact" ? "sm" : "md"}
            />
          </div>
        ) : (
          <div className={cn(density === "compact" ? "py-1" : "py-2")}>
            {items.map((item, idx) => (
              <div key={idx} className={cn(itemGap, idx === 0 ? "" : "border-t border-border/30")}>
                {renderItem(item, idx)}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

