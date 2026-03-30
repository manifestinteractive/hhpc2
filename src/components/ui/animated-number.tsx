"use client";

import { useEffect, useState } from "react";
import { useMotionValue, useSpring } from "motion/react";

type AnimatedNumberProps = {
  className?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  value: number;
};

function formatAnimatedValue(
  value: number,
  decimals: number,
  prefix: string,
  suffix: string,
) {
  return `${prefix}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)}${suffix}`;
}

export function AnimatedNumber({
  className,
  decimals = 0,
  prefix = "",
  suffix = "",
  value,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 24,
    mass: 0.8,
    stiffness: 120,
  });
  const [displayValue, setDisplayValue] = useState(() =>
    formatAnimatedValue(0, decimals, prefix, suffix),
  );

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      setDisplayValue(
        formatAnimatedValue(latest, decimals, prefix, suffix),
      );
    });

    return unsubscribe;
  }, [decimals, prefix, springValue, suffix]);

  return <span className={className}>{displayValue}</span>;
}
