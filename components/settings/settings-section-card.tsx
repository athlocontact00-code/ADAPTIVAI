"use client";

import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: SettingsSectionCardProps) {
  return (
    <Card
      className={cn(
        "rounded-[18px] border border-white/[0.06] bg-card/50 backdrop-blur-sm transition-default hover:bg-card/60",
        className
      )}
    >
      <CardHeader className="p-5 pb-3">
        <CardTitle className="flex items-center gap-2.5 text-sm font-medium">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-5 pt-2">{children}</CardContent>
    </Card>
  );
}
