// ---- FLOWSTATE: Placeholder AI Hook (Demo-Safe) ----
// NOTE: This simulates posture/attention signals.
// Replace this block later with MediaPipe outputs.

import { useEffect, useState } from "react";

export function useSimulatedAttention() {
  const [postureScore, setPostureScore] = useState(1); // 1 = good, 0 = poor
  const [isDistracted, setIsDistracted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate gradual drift
      setPostureScore((prev) => {
        const next = Math.max(0, Math.min(1, prev - Math.random() * 0.15));
        setIsDistracted(next < 0.6);
        return next;
      });
    }, 4000); // every 4s

    return () => clearInterval(interval);
  }, []);

  return { postureScore, isDistracted };
}

// ---- END Placeholder AI Hook ----
