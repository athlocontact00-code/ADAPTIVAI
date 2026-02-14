"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";

interface CounterProps {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}

function Counter({ target, suffix = "", prefix = "", duration = 2 }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: duration * 1000 });
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      motionValue.set(target);
    }
  }, [isInView, target, motionValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
  }, [springValue]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

interface StatsCounterProps {
  className?: string;
}

export function StatsCounter({ className }: StatsCounterProps) {
  return (
    <motion.div 
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
        <div className="text-center">
          <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
            <Counter target={500} suffix="+" />
          </div>
          <div className="text-sm text-gray-400 font-medium">Athletes</div>
        </div>
        
        <div className="hidden sm:block w-px h-12 bg-gray-700" />
        
        <div className="text-center">
          <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
            <Counter target={10} suffix="K+" />
          </div>
          <div className="text-sm text-gray-400 font-medium">Workouts</div>
        </div>
        
        <div className="hidden sm:block w-px h-12 bg-gray-700" />
        
        <div className="text-center">
          <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
            <Counter target={98} suffix="%" />
          </div>
          <div className="text-sm text-gray-400 font-medium">Satisfaction</div>
        </div>
      </div>
    </motion.div>
  );
}