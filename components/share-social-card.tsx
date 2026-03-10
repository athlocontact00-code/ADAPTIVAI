"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Share2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

interface ViralShareCardProps {
    title: string;
    subtitle: string;
    metrics: { label: string; value: string }[];
    ctaText?: string;
}

export function ViralShareCard({ title, subtitle, metrics, ctaText = "My Coach" }: ViralShareCardProps) {
    return (
        <div className="flex flex-col gap-4">
            <motion.div
                id="viral-share-container"
                initial={{ opacity: 0, y: 20, rotateX: -10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ perspective: 1000 }}
            >
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-0 shadow-2xl ring-1 ring-white/10 sm:w-[400px]">
                    {/* Animated Background */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute -left-[50%] -top-[50%] h-[200%] w-[200%] animate-[spin_15s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(255,122,24,0.3)_360deg)] opacity-20" />
                        <div className="absolute inset-[2px] rounded-[inherit] bg-gradient-to-br from-black via-[#0a0a0a] to-[#111]" />
                        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                    </div>

                    <div className="relative z-10 p-8 flex flex-col items-center text-center">
                        <Logo size={40} className="text-primary mb-6 drop-shadow-[0_0_15px_rgba(255,122,24,0.5)]" />

                        <h3 className="text-3xl font-black text-white tracking-tight leading-none mb-2 bg-clip-text">
                            {title}
                        </h3>
                        <p className="text-white/60 font-medium tracking-wide uppercase text-xs mb-8">
                            {subtitle}
                        </p>

                        <div className="w-full grid grid-cols-2 gap-3 mb-6">
                            {metrics.map((metric, idx) => (
                                <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-md">
                                    <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-1">{metric.label}</div>
                                    <div className="text-2xl font-black text-white">{metric.value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex items-center justify-between w-full border-t border-white/10 pt-6">
                            <div className="text-left">
                                <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Powered by</div>
                                <div className="text-sm font-black text-white">AdaptivAI</div>
                            </div>
                            <div className="bg-primary/20 text-primary text-xs font-bold px-3 py-1.5 rounded-full border border-primary/30 flex items-center gap-1">
                                {ctaText}
                            </div>
                        </div>
                    </div>
                </Card>
            </motion.div>

            <div className="flex justify-center gap-3 w-full sm:w-[400px]">
                <Button variant="outline" className="flex-1 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={() => navigator.clipboard.writeText("https://www.adaptivai.online")}>
                    <Copy className="w-4 h-4 mr-2 text-white/50" />
                    Copy Link
                </Button>
                <Button className="flex-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share to Social
                </Button>
            </div>
        </div>
    );
}
