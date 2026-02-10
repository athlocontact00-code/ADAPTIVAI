"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Flame, Zap, MoreHorizontal, Download, Sparkles, Loader2 } from "lucide-react";

interface DashboardHeroCardProps {
  greeting: string;
  subtitle: string;
  primaryCta: {
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: "default" | "outline";
  };
  checkInStreak?: number;
  workoutStreak?: number;
  adaptedBadge?: string | null;
  onExportClick?: () => void;
  exportLoading?: boolean;
  checkinSlot?: ReactNode;
}

export function DashboardHeroCard({
  greeting,
  subtitle,
  primaryCta,
  checkInStreak = 0,
  workoutStreak = 0,
  adaptedBadge,
  onExportClick,
  exportLoading = false,
  checkinSlot,
}: DashboardHeroCardProps) {
  const PrimaryCta = primaryCta.href ? (
    <Link href={primaryCta.href} className="w-full sm:w-auto">
      <Button size="lg" variant={primaryCta.variant || "default"} className="font-medium w-full sm:w-auto">
        {primaryCta.label}
      </Button>
    </Link>
  ) : (
    <Button
      size="lg"
      variant={primaryCta.variant || "default"}
      onClick={primaryCta.onClick}
      className="font-medium w-full sm:w-auto"
    >
      {primaryCta.label}
    </Button>
  );

  return (
    <div className="relative rounded-card border border-border/50 bg-card overflow-hidden transition-all duration-150 hover:border-border/80">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="p-5 relative">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-1.5">
              <h2 className="text-lg font-semibold tracking-tight">{greeting}</h2>
              {adaptedBadge && (
                <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="h-3 w-3" />
                  {adaptedBadge}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground/80 mb-4 max-w-md leading-relaxed">{subtitle}</p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {checkInStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs font-medium bg-secondary/50 text-secondary-foreground border border-border/50">
                  <Flame className="h-3 w-3 text-orange-400" />
                  {checkInStreak}d check-in streak
                </span>
              )}
              {workoutStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs font-medium bg-secondary/50 text-secondary-foreground border border-border/50">
                  <Zap className="h-3 w-3 text-amber-400" />
                  {workoutStreak}w workout streak
                </span>
              )}
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              {PrimaryCta}
            </div>

            {checkinSlot && (
              <div className="mt-4">
                {checkinSlot}
              </div>
            )}
          </div>

          <div className="lg:self-start">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {onExportClick && (
                  <DropdownMenuItem onClick={onExportClick} disabled={exportLoading} className="text-sm">
                    {exportLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {exportLoading ? "Exporting..." : "Export weekly summary"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
