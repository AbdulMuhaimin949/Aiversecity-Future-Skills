import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Short, non-blocking entrance for major content groups. */
export function MotionSection({
  children,
  className,
  delay = 0,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "data-testid"?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
      className={cn(className)}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.24, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.section>
  );
}
