"use client";

import { cn } from "@/lib/utils";

interface AnimatedBgProps {
  className?: string;
}

export function AnimatedBg({ className }: AnimatedBgProps) {
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      {/* Orange blob */}
      <div 
        className="absolute -top-40 -left-40 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl opacity-70 animate-float-slow"
        style={{
          animation: "float-1 25s ease-in-out infinite"
        }}
      />
      
      {/* Purple blob */}
      <div 
        className="absolute top-1/3 -right-20 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl opacity-60 animate-float-slower"
        style={{
          animation: "float-2 30s ease-in-out infinite reverse"
        }}
      />
      
      {/* Blue blob */}
      <div 
        className="absolute -bottom-32 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl opacity-50 animate-float-slowest"
        style={{
          animation: "float-3 20s ease-in-out infinite"
        }}
      />
      
      <style jsx>{`
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(20px, -20px) rotate(5deg); }
          50% { transform: translate(-10px, 10px) rotate(-3deg); }
          75% { transform: translate(-20px, -10px) rotate(2deg); }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          33% { transform: translate(-30px, 20px) rotate(-2deg) scale(1.1); }
          66% { transform: translate(15px, -25px) rotate(4deg) scale(0.9); }
        }
        
        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(15px, -15px) rotate(3deg); }
          40% { transform: translate(-25px, 5px) rotate(-2deg); }
          60% { transform: translate(10px, 20px) rotate(1deg); }
          80% { transform: translate(-5px, -10px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}