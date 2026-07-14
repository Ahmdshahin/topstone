"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function OfflineToast() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-xl border border-destructive/20"
        >
          <WifiOff className="w-5 h-5" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">You are offline</span>
            <span className="text-xs opacity-90">Changes will sync when reconnected.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
