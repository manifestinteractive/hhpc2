"use client";

import { useEffect, useRef, useState } from "react";
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
  const [displayValue, setDisplayValue] = useState(0);
  const hasMountedRef = useRef(false);
  const previousValueRef = useRef(0);

  useEffect(() => {
    const previousValue = hasMountedRef.current ? previousValueRef.current : 0;
    hasMountedRef.current = true;
    previousValueRef.current = value;

    motionValue.set(previousValue);

    const frame = window.requestAnimationFrame(() => {
      motionValue.set(value);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [motionValue, value]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      setDisplayValue(latest);
    });

    return unsubscribe;
  }, [springValue]);

  return (
    <span className={className}>
      {formatAnimatedValue(displayValue, decimals, prefix, suffix)}
    </span>
  );
}
