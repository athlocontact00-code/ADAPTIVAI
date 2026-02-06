"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "adaptivai.ui.compactMode.v1";

export function useCompactMode(): { compact: boolean; setCompact: (v: boolean) => void } {
  const [compact, setCompactState] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "1" || raw === "true") setCompactState(true);
    } catch {
      // ignore
    }
  }, []);

  const setCompact = (v: boolean) => {
    setCompactState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      // ignore
    }
  };

  return { compact, setCompact };
}

