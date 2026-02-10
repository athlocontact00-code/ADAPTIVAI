"use client";

import { Logo } from "@/components/logo";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-sm text-center space-y-4">
        <div className="flex justify-center gap-2 items-center mb-2">
          <Logo size={40} className="shrink-0" />
          <span className="text-lg font-bold">AdaptivAI</span>
        </div>
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="text-zinc-400 text-sm">
          Connect to the internet to use AdaptivAI. Previously visited pages may still be available.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
