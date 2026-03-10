"use client";

import { motion } from "framer-motion";
import { Clock, Zap, TrendingUp, Bike, Waves, Dumbbell, Footprints } from "lucide-react";

interface ActivityWorkout {
    id: string;
    title: string;
    type: string;
    date: string;
    durationMin: number | null;
    tss: number | null;
    completed: boolean;
}

interface ActivityFeedProps {
    workouts: ActivityWorkout[];
}

function getSportIcon(type: string) {
    const t = type.toLowerCase();
    if (t.includes("bike") || t.includes("cycling")) return Bike;
    if (t.includes("swim")) return Waves;
    if (t.includes("strength") || t.includes("gym")) return Dumbbell;
    return Footprints; // default to running
}

function getSportGradient(type: string) {
    const t = type.toLowerCase();
    if (t.includes("bike") || t.includes("cycling")) return "from-green-500/20 to-emerald-500/10";
    if (t.includes("swim")) return "from-blue-500/20 to-cyan-500/10";
    if (t.includes("strength") || t.includes("gym")) return "from-purple-500/20 to-violet-500/10";
    return "from-orange-500/20 to-amber-500/10"; // run
}

function getSportAccent(type: string) {
    const t = type.toLowerCase();
    if (t.includes("bike") || t.includes("cycling")) return "text-emerald-400";
    if (t.includes("swim")) return "text-blue-400";
    if (t.includes("strength") || t.includes("gym")) return "text-purple-400";
    return "text-orange-400"; // run
}

function formatDuration(mins: number | null): string {
    if (!mins) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);

    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${diffH}h ago`;
    if (diffH < 48) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityFeed({ workouts }: ActivityFeedProps) {
    if (workouts.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground/50 px-1">
                Recent Activity
            </h3>
            {workouts.slice(0, 5).map((workout, idx) => {
                const Icon = getSportIcon(workout.type);
                const gradient = getSportGradient(workout.type);
                const accent = getSportAccent(workout.type);

                return (
                    <motion.div
                        key={workout.id}
                        className="group relative rounded-2xl border border-white/[0.06] bg-card/50 overflow-hidden"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: idx * 0.08 }}
                        whileHover={{ scale: 1.01 }}
                    >
                        {/* Sport gradient stripe */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-40`} />

                        <div className="relative p-4">
                            <div className="flex items-start gap-3">
                                {/* Sport icon */}
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20 ring-1 ring-white/5`}>
                                    <Icon className={`h-5 w-5 ${accent}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-white truncate">
                                                {workout.title}
                                            </h4>
                                            <p className="text-[11px] text-white/40 mt-0.5">
                                                {formatDate(workout.date)}
                                            </p>
                                        </div>
                                        {workout.completed && (
                                            <span className="shrink-0 text-[10px] font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                Done
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats row — Strava-style */}
                                    <div className="flex items-center gap-4 mt-3">
                                        {workout.durationMin != null && (
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3 w-3 text-white/30" />
                                                <span className="text-xs font-medium text-white/70 tabular-nums">
                                                    {formatDuration(workout.durationMin)}
                                                </span>
                                            </div>
                                        )}
                                        {workout.tss != null && workout.tss > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <Zap className="h-3 w-3 text-white/30" />
                                                <span className="text-xs font-medium text-white/70 tabular-nums">
                                                    {workout.tss} TSS
                                                </span>
                                            </div>
                                        )}
                                        {workout.durationMin != null && workout.tss != null && workout.tss > 0 && workout.durationMin > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <TrendingUp className="h-3 w-3 text-white/30" />
                                                <span className="text-xs font-medium text-white/70 tabular-nums">
                                                    IF {(workout.tss / workout.durationMin * 60 / 100).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
