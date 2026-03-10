"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, X, Copy, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GlobalViralInvite() {
    const [isOpen, setIsOpen] = useState(false);
    const shareUrl = "https://www.adaptivai.online";
    const shareText = "I'm training smarter with AdaptivAI – an AI-powered coach for athletes. Join me! 🏋️‍♂️🔥";

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied! Share it with friends 🔥");
    };

    const handleShareNative = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: "AdaptivAI – AI Coach", text: shareText, url: shareUrl });
            } catch {
                // User cancelled
            }
        } else {
            handleCopyLink();
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-orange-500 to-pink-500 text-white shadow-2xl shadow-primary/30 ring-2 ring-white/10"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                    boxShadow: isOpen
                        ? "0 0 0 0 rgba(249, 115, 22, 0)"
                        : [
                            "0 0 0 0 rgba(249, 115, 22, 0.4)",
                            "0 0 0 15px rgba(249, 115, 22, 0)",
                            "0 0 0 0 rgba(249, 115, 22, 0)",
                        ],
                }}
                transition={{
                    boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                }}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <X className="h-6 w-6" />
                        </motion.div>
                    ) : (
                        <motion.div key="share" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                            <Users className="h-6 w-6" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* Popup Card */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed bottom-24 right-6 z-50 w-[320px] rounded-2xl border border-white/10 bg-gradient-to-br from-black via-[#0a0a0a] to-[#111] p-6 shadow-2xl ring-1 ring-white/5"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-pink-500/20">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">Invite Friends</h3>
                                <p className="text-xs text-white/50">Share the love, train together</p>
                            </div>
                        </div>

                        <p className="text-xs text-white/60 mb-4 leading-relaxed">
                            Know someone who'd love an AI-powered training coach? Send them AdaptivAI – it's completely free! 🎉
                        </p>

                        <div className="space-y-2">
                            <Button
                                onClick={handleShareNative}
                                className="w-full bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-600/90 text-white rounded-xl"
                            >
                                <Share2 className="mr-2 h-4 w-4" />
                                Share with Friends
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleCopyLink}
                                className="w-full rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Invite Link
                            </Button>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                            <div className="flex -space-x-2">
                                {["bg-blue-500", "bg-green-500", "bg-purple-500"].map((c, i) => (
                                    <div key={i} className={`h-6 w-6 rounded-full ${c} ring-2 ring-black text-[8px] font-bold text-white flex items-center justify-center`}>
                                        {["BK", "JR", "MK"][i]}
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] text-white/40">+2.4k athletes joined</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
