"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface MotivationalStreakProps {
    currentStreak: number;
    bestStreak?: number;
}

export function MotivationalStreak({ currentStreak, bestStreak }: MotivationalStreakProps) {
    const isOnFire = currentStreak >= 3;
    const isBestEver = bestStreak != null && currentStreak >= bestStreak && currentStreak > 0;

    return (
        <motion.div
            className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-card/50 px-4 py-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
        >
            <motion.div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${isOnFire
                        ? "bg-gradient-to-br from-orange-500/20 to-red-500/20"
                        : "bg-muted/30"
                    }`}
                animate={isOnFire ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
                <Flame
                    className={`h-5 w-5 ${isOnFire ? "text-orange-400" : "text-muted-foreground/50"
                        }`}
                />
            </motion.div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                    <motion.span
                        className="text-2xl font-bold tabular-nums"
                        key={currentStreak}
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                        {currentStreak}
                    </motion.span>
                    <span className="text-xs text-muted-foreground/60">
                        {currentStreak === 1 ? "day" : "days"} streak
                    </span>
                </div>
                {isBestEver && (
                    <motion.p
                        className="text-[10px] text-orange-400/80 font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        🏆 Personal best!
                    </motion.p>
                )}
            </div>
            {/* Mini bar visualization */}
            <div className="flex items-end gap-0.5 h-6">
                {Array.from({ length: 7 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className={`w-1 rounded-full ${i < currentStreak
                                ? isOnFire
                                    ? "bg-gradient-to-t from-orange-500 to-amber-400"
                                    : "bg-primary/60"
                                : "bg-muted/20"
                            }`}
                        initial={{ height: 0 }}
                        animate={{ height: i < currentStreak ? 8 + i * 2.5 : 4 }}
                        transition={{ duration: 0.4, delay: i * 0.05 }}
                    />
                ))}
            </div>
        </motion.div>
    );
}
