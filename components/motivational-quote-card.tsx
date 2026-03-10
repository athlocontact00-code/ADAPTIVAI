"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";
import { useState, useCallback } from "react";

interface QuoteData {
    text: string;
    author: string;
    category: string;
    categoryDisplay: { label: string; color: string };
}

interface MotivationalQuoteCardProps {
    quote: QuoteData;
}

const EXTRA_QUOTES: QuoteData[] = [
    { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Arnold Schwarzenegger", category: "motivation", categoryDisplay: { label: "Motivation", color: "text-orange-400" } },
    { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery", category: "mindset", categoryDisplay: { label: "Mindset", color: "text-blue-400" } },
    { text: "Success isn't always about greatness. It's about consistency.", author: "Dwayne Johnson", category: "consistency", categoryDisplay: { label: "Consistency", color: "text-emerald-400" } },
    { text: "The body achieves what the mind believes.", author: "Napoleon Hill", category: "performance", categoryDisplay: { label: "Performance", color: "text-purple-400" } },
    { text: "It never gets easier, you just get faster.", author: "Greg LeMond", category: "endurance", categoryDisplay: { label: "Endurance", color: "text-amber-400" } },
];

export function MotivationalQuoteCard({ quote: initialQuote }: MotivationalQuoteCardProps) {
    const [currentQuote, setCurrentQuote] = useState<QuoteData>(initialQuote);
    const [isAnimating, setIsAnimating] = useState(false);

    const cycleQuote = useCallback(() => {
        if (isAnimating) return;
        setIsAnimating(true);
        const pool = [initialQuote, ...EXTRA_QUOTES];
        const currentIdx = pool.findIndex(q => q.text === currentQuote.text);
        const nextIdx = (currentIdx + 1) % pool.length;
        setCurrentQuote(pool[nextIdx]);
        setTimeout(() => setIsAnimating(false), 500);
    }, [initialQuote, currentQuote, isAnimating]);

    return (
        <motion.div
            className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-card/80 via-card/50 to-primary/5 p-5 overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
        >
            {/* Decorative glow */}
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary/60" />
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                            Daily Inspiration
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={cycleQuote}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                        aria-label="Next quote"
                    >
                        <RefreshCw className={`h-3 w-3 text-muted-foreground/40 ${isAnimating ? "animate-spin" : ""}`} />
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentQuote.text}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35 }}
                    >
                        <blockquote className="text-sm font-medium text-white/90 leading-relaxed italic">
                            &ldquo;{currentQuote.text}&rdquo;
                        </blockquote>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs text-white/50">— {currentQuote.author}</span>
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 ${currentQuote.categoryDisplay.color}`}>
                                {currentQuote.categoryDisplay.label}
                            </span>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
