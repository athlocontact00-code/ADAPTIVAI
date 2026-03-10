"use client";

import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrainingLoadBannerProps {
    tsb: number | null;
    readiness: number | null;
}

function getLoadStatus(tsb: number | null): {
    emoji: string;
    label: string;
    description: string;
    color: string;
    Icon: typeof TrendingUp;
} {
    if (tsb === null) {
        return {
            emoji: "📊",
            label: "No data yet",
            description: "Complete a few workouts to see your training status.",
            color: "text-muted-foreground",
            Icon: Minus,
        };
    }
    if (tsb > 15) {
        return {
            emoji: "💪",
            label: "Fresh & ready",
            description: "You're well-rested. Great day for a hard session!",
            color: "text-emerald-400",
            Icon: TrendingUp,
        };
    }
    if (tsb > 0) {
        return {
            emoji: "✅",
            label: "Balanced",
            description: "Good shape. You can train normally today.",
            color: "text-blue-400",
            Icon: Minus,
        };
    }
    if (tsb > -15) {
        return {
            emoji: "🧘",
            label: "Fatigued",
            description: "Consider an easy day or active recovery.",
            color: "text-amber-400",
            Icon: TrendingDown,
        };
    }
    return {
        emoji: "🛑",
        label: "Overreaching",
        description: "Rest is critical. Avoid high intensity today.",
        color: "text-red-400",
        Icon: TrendingDown,
    };
}

export function TrainingLoadBanner({ tsb, readiness }: TrainingLoadBannerProps) {
    const status = getLoadStatus(tsb);
    const StatusIcon = status.Icon;

    return (
        <motion.div
            className="rounded-2xl border border-white/[0.06] bg-card/50 p-4 sm:p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-xl">
                    {status.emoji}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-semibold ${status.color}`}>
                            {status.label}
                        </h3>
                        <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
                        {status.description}
                    </p>
                </div>
                {tsb !== null && (
                    <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5">
                            <Activity className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-xs text-muted-foreground/50">TSB</span>
                        </div>
                        <span className={`text-lg font-bold tabular-nums ${status.color}`}>
                            {tsb > 0 ? "+" : ""}{tsb}
                        </span>
                        {readiness !== null && (
                            <div className="text-[10px] text-muted-foreground/40 mt-0.5">
                                Readiness {readiness}%
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
