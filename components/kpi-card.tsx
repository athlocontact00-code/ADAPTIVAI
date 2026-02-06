"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface KPICardProps {
  title: string;
  value: string | number | null | undefined;
  subtitle?: string;
  icon?: ReactNode;
  iconColor?: string;
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "outline" | "destructive";
    className?: string;
  };
  trend?: {
    value: number;
    label?: string;
  };
  tooltip?: string;
  className?: string;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  iconColor = "text-muted-foreground",
  badge,
  trend,
  tooltip,
  className = "",
  onClick,
}: KPICardProps) {
  const displayValue = value === null || value === undefined ? "—" : value;

  const cardContent = (
    <Card
      className={`h-full transition-colors ${onClick ? "cursor-pointer hover:border-primary/50" : ""} ${className}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className={iconColor}>{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        {(subtitle || badge || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {badge && (
              <Badge variant={badge.variant} className={badge.className}>
                {badge.label}
              </Badge>
            )}
            {trend && (
              <span
                className={`text-xs ${
                  trend.value > 0
                    ? "text-green-500"
                    : trend.value < 0
                    ? "text-red-500"
                    : "text-muted-foreground"
                }`}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value}%{trend.label ? ` ${trend.label}` : ""}
              </span>
            )}
            {subtitle && !badge && !trend && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
        {subtitle && (badge || trend) && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}

export function KPICardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}
