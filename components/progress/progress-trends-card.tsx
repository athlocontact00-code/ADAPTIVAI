"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { BarChart3, TrendingUp, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-extensions";
import type { ProgressTrendsData } from "@/lib/actions/progress";
import { cn } from "@/lib/utils";

// Placement: Between KPI and Weekly/Monthly story. Analytics before narrative gives a natural "data → insight" flow.
interface ProgressTrendsCardProps {
  trends: ProgressTrendsData | null;
  className?: string;
}

const CHART_COLORS = {
  ctl: "hsl(var(--chart-1))",
  atl: "hsl(var(--chart-2))",
  tsb: "hsl(var(--chart-3))",
  tss: "hsl(var(--chart-1))",
  hours: "hsl(var(--chart-2))",
  readiness: "hsl(var(--chart-3))",
};

export function ProgressTrendsCard({ trends, className }: ProgressTrendsCardProps) {
  const router = useRouter();
  const [perfRange, setPerfRange] = useState<"30" | "90">("30");

  const hasAnyData = useMemo(() => {
    if (!trends) return false;
    return (
      trends.performanceData.length > 0 ||
      trends.weeklyLoad.length > 0 ||
      trends.readiness14d.length > 0 ||
      trends.disciplineSplit.length > 0
    );
  }, [trends]);

  if (!trends || !hasAnyData) {
    return (
      <Card className={cn("border-border/50 overflow-hidden", className)}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[140px] rounded-lg border border-dashed border-border/50 bg-muted/5 flex items-center justify-center">
            <EmptyState
              title="No trends yet"
              description="Add workouts and complete check-ins to unlock performance, load, and readiness charts."
              cta={{ label: "Add workouts", onClick: () => router.push("/calendar") }}
              icon={<BarChart3 className="h-5 w-5 text-muted-foreground/70" />}
              size="sm"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  const perfData = trends.performanceData.slice(-(perfRange === "30" ? 30 : 90));

  return (
    <Card className={cn("border-border/50 overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Trends
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Performance: CTL / ATL / TSB */}
        {perfData.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Performance (CTL / ATL / TSB)</span>
              <div className="flex rounded-md border border-border/50 overflow-hidden">
                {(["30", "90"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPerfRange(r)}
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-medium transition-colors",
                      perfRange === r
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perfData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ctlFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.ctl} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.ctl} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 9 }} width={28} />
                  <ChartTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  <Area type="monotone" dataKey="ctl" stroke={CHART_COLORS.ctl} fill="url(#ctlFill)" name="CTL" strokeWidth={1.5} />
                  <Line type="monotone" dataKey="atl" stroke={CHART_COLORS.atl} strokeWidth={1} dot={false} name="ATL" />
                  <Line type="monotone" dataKey="tsb" stroke={CHART_COLORS.tsb} strokeWidth={1} dot={false} strokeDasharray="4 4" name="TSB" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weekly Load: TSS + Hours */}
        {trends.weeklyLoad.length >= 2 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground block mb-2">Weekly Load (TSS + Hours)</span>
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.weeklyLoad.slice(-12)} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="weekStart"
                    tick={{ fontSize: 9 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis yAxisId="tss" tick={{ fontSize: 9 }} width={28} />
                  <YAxis yAxisId="hours" orientation="right" tick={{ fontSize: 9 }} width={28} />
                  <ChartTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  />
                  <Bar yAxisId="tss" dataKey="tss" fill={CHART_COLORS.tss} name="TSS" radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="hours" dataKey="hours" fill={CHART_COLORS.hours} name="Hours" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Readiness 14d */}
        {trends.readiness14d.length >= 2 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground block mb-2">Readiness (14 days)</span>
            <div className="h-[100px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.readiness14d} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} width={28} />
                  <ChartTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  />
                  <Line type="monotone" dataKey="value" stroke={CHART_COLORS.readiness} strokeWidth={1.5} dot={false} name="Readiness" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Discipline split (optional) */}
        {trends.disciplineSplit.length > 0 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground block mb-2">Discipline split (hours)</span>
            <div className="flex flex-wrap gap-2">
              {trends.disciplineSplit.map((d) => (
                <div
                  key={d.name}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/20 px-2.5 py-1 text-xs"
                >
                  <Activity className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground tabular-nums">{d.value}h</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
