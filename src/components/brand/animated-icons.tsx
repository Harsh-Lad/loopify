"use client";

import { motion, useReducedMotion, type Transition, type Variants } from "motion/react";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Animated line icons, drawn on the same 24px grid and stroke as Tabler so
 * they sit next to the static set. Use them where an icon carries emphasis
 * (stat tiles, empty states, error pages, the landing page), not in dense UI.
 *
 * trigger:
 * - "hover"   animates while the icon itself is hovered (default)
 * - "inherit" follows a parent motion element's "rest" / "active" variants,
 *             e.g. a card with whileHover="active"
 * - "mount"   plays once when it appears
 * - "loop"    plays forever, for hero moments
 */
export type IconTrigger = "hover" | "inherit" | "mount" | "loop";

type IconProps = { className?: string; trigger?: IconTrigger; strokeWidth?: number };

const LoopContext = createContext(false);

function useRepeat(): Partial<Transition> {
  return useContext(LoopContext) ? { repeat: Infinity, repeatDelay: 1.4 } : {};
}

function Frame({ trigger = "hover", className, strokeWidth = 1.9, children }: IconProps & { children: ReactNode }) {
  const reduce = useReducedMotion();
  const control = reduce
    ? {}
    : trigger === "loop" || trigger === "mount"
      ? { initial: "rest", animate: "active" }
      : trigger === "hover"
        ? { initial: "rest", animate: "rest", whileHover: "active" }
        : {};
  return (
    <LoopContext.Provider value={trigger === "loop" && !reduce}>
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={cn("size-6 shrink-0 overflow-visible", className)}
        {...control}
      >
        {children}
      </motion.svg>
    </LoopContext.Provider>
  );
}

function useDraw(delay = 0, duration = 0.6): Variants {
  const repeat = useRepeat();
  return {
    rest: { pathLength: 1, opacity: 1 },
    active: { pathLength: [0, 1], opacity: [0.3, 1], transition: { duration, delay, ease: "easeInOut", ...repeat } },
  };
}

export function AnimatedFlame(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <motion.g
        style={{ originX: "50%", originY: "100%" }}
        variants={{
          rest: { scaleY: 1, rotate: 0 },
          active: {
            scaleY: [1, 1.12, 0.94, 1.08, 1],
            rotate: [0, -4, 3, -2, 0],
            transition: { duration: 0.9, ease: "easeInOut", ...repeat },
          },
        }}
      >
        <path d="M12 3c.6 3.3 4.8 5.2 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.3 1.2-3.9 2.4-5 .2 1.5.9 2.6 2 3.2C11.2 9 11 6 12 3Z" />
        <motion.path
          d="M12 21a2.2 2.2 0 0 1-2.2-2.2c0-1.5 1.3-2.2 2.2-3.6.9 1.4 2.2 2.1 2.2 3.6A2.2 2.2 0 0 1 12 21Z"
          variants={{
            rest: { opacity: 0.55 },
            active: { opacity: [0.55, 1, 0.55], transition: { duration: 0.9, ...repeat } },
          }}
        />
      </motion.g>
    </Frame>
  );
}

export function AnimatedCheckCircle(props: IconProps) {
  const ring = useDraw(0, 0.5);
  const tick = useDraw(0.35, 0.35);
  return (
    <Frame {...props}>
      <motion.circle cx="12" cy="12" r="9" variants={ring} />
      <motion.path d="m8.5 12.2 2.4 2.4 4.8-5" variants={tick} />
    </Frame>
  );
}

export function AnimatedChartBars(props: IconProps) {
  const repeat = useRepeat();
  const bar = (delay: number): Variants => ({
    rest: { scaleY: 1 },
    active: { scaleY: [1, 0.3, 1], transition: { duration: 0.6, delay, ease: "easeOut", ...repeat } },
  });
  return (
    <Frame {...props}>
      <path d="M3 21h18" />
      {[
        { x: 5, h: 7, d: 0 },
        { x: 10.5, h: 12, d: 0.08 },
        { x: 16, h: 16, d: 0.16 },
      ].map((b) => (
        <motion.rect
          key={b.x}
          x={b.x}
          y={18 - b.h}
          width="3.5"
          height={b.h}
          rx="1"
          style={{ originY: "100%", transformBox: "fill-box" }}
          variants={bar(b.d)}
        />
      ))}
    </Frame>
  );
}

export function AnimatedTrendUp(props: IconProps) {
  const line = useDraw(0, 0.7);
  const head = useDraw(0.55, 0.25);
  return (
    <Frame {...props}>
      <motion.path d="m3 17 6-6 4 4 8-8" variants={line} />
      <motion.path d="M15 7h6v6" variants={head} />
    </Frame>
  );
}

export function AnimatedCalendar(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <rect x="4" y="5" width="16" height="16" rx="2.5" />
      <path d="M4 10h16" />
      <motion.g
        variants={{
          rest: { y: 0 },
          active: { y: [0, -2, 0], transition: { duration: 0.45, ...repeat } },
        }}
      >
        <path d="M8 3v4M16 3v4" />
      </motion.g>
      <motion.rect
        x="13.5"
        y="13.5"
        width="3"
        height="3"
        rx="0.8"
        fill="currentColor"
        style={{ transformBox: "fill-box", originX: "50%", originY: "50%" }}
        variants={{
          rest: { scale: 1 },
          active: { scale: [1, 0, 1.3, 1], transition: { duration: 0.6, delay: 0.15, ...repeat } },
        }}
      />
    </Frame>
  );
}

export function AnimatedBell(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <motion.g
        style={{ originX: "50%", originY: "10%" }}
        variants={{
          rest: { rotate: 0 },
          active: { rotate: [0, 16, -14, 10, -6, 0], transition: { duration: 0.8, ...repeat } },
        }}
      >
        <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" />
        <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
      </motion.g>
    </Frame>
  );
}

export function AnimatedRocket(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <motion.g
        variants={{
          rest: { x: 0, y: 0 },
          active: { x: [0, 2, 0], y: [0, -2, 0], transition: { duration: 0.6, ease: "easeInOut", ...repeat } },
        }}
      >
        <path d="M5 15c-1 1.3-1.5 3.3-1.5 5.5 2.2 0 4.2-.5 5.5-1.5" />
        <path d="M9 18 6 15c.8-4.6 3.9-9.6 11.5-11.5C15.6 11 10.6 14.2 9 18Z" />
        <circle cx="14.5" cy="9.5" r="1.4" />
      </motion.g>
      <motion.path
        d="M4.5 19.5 3 21"
        variants={{
          rest: { opacity: 0 },
          active: { opacity: [0, 1, 0], transition: { duration: 0.6, ...repeat } },
        }}
      />
    </Frame>
  );
}

export function AnimatedSparkles(props: IconProps) {
  const repeat = useRepeat();
  const star = (delay: number): Variants => ({
    rest: { scale: 1, rotate: 0 },
    active: { scale: [1, 0.4, 1.15, 1], rotate: [0, 45, 0], transition: { duration: 0.7, delay, ...repeat } },
  });
  const box = { transformBox: "fill-box", originX: "50%", originY: "50%" } as const;
  return (
    <Frame {...props}>
      <motion.path
        style={box}
        variants={star(0)}
        d="M10 3.5 11.6 8a3 3 0 0 0 1.9 1.9L18 11.5l-4.5 1.6a3 3 0 0 0-1.9 1.9L10 19.5 8.4 15a3 3 0 0 0-1.9-1.9L2 11.5l4.5-1.6A3 3 0 0 0 8.4 8L10 3.5Z"
      />
      <motion.path style={box} variants={star(0.15)} d="M18.5 2.5v4M16.5 4.5h4" />
      <motion.path style={box} variants={star(0.3)} d="M19 17v3M17.5 18.5h3" />
    </Frame>
  );
}

export function AnimatedTrophy(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <motion.g
        variants={{
          rest: { y: 0, rotate: 0 },
          active: { y: [0, -2.5, 0], rotate: [0, -6, 6, 0], transition: { duration: 0.7, ...repeat } },
        }}
      >
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.8M17 6h2.5a2.5 2.5 0 0 1-2.6 3.8" />
      </motion.g>
      <motion.path
        d="M10 7.5v2"
        variants={{
          rest: { opacity: 0 },
          active: { opacity: [0, 1, 0], transition: { duration: 0.7, delay: 0.2, ...repeat } },
        }}
      />
    </Frame>
  );
}

export function AnimatedTarget(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <circle cx="11" cy="13" r="8" />
      <circle cx="11" cy="13" r="4" />
      <motion.g
        variants={{
          rest: { x: 0, y: 0 },
          active: { x: [6, 0], y: [-6, 0], transition: { duration: 0.4, ease: "backOut", ...repeat } },
        }}
      >
        <path d="m11 13 9-9M17 4h3v3" />
      </motion.g>
    </Frame>
  );
}

export function AnimatedClock(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <circle cx="12" cy="12" r="9" />
      <motion.path
        d="M12 12V7"
        style={{ originX: "50%", originY: "100%", transformBox: "fill-box" }}
        variants={{
          rest: { rotate: 0 },
          active: { rotate: 360, transition: { duration: 1.2, ease: "easeInOut", ...repeat } },
        }}
      />
      <path d="M12 12h3.5" />
    </Frame>
  );
}

export function AnimatedAlert(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <motion.g
        variants={{
          rest: { x: 0 },
          active: { x: [0, -1.5, 1.5, -1, 1, 0], transition: { duration: 0.5, ...repeat } },
        }}
      >
        <path d="M10.3 4.2 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9.5v4M12 17h.01" />
      </motion.g>
    </Frame>
  );
}

export function AnimatedCompass(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <circle cx="12" cy="12" r="9" />
      <motion.path
        d="m15.5 8.5-2 5-5 2 2-5 5-2Z"
        style={{ originX: "50%", originY: "50%", transformBox: "view-box" }}
        variants={{
          rest: { rotate: 0 },
          active: { rotate: [0, 200, 150, 380, 360], transition: { duration: 1.6, ease: "easeInOut", ...repeat } },
        }}
      />
    </Frame>
  );
}

export function AnimatedShield(props: IconProps) {
  const tick = useDraw(0.1, 0.4);
  return (
    <Frame {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.4 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5.1 7.5-9.5V6L12 3Z" />
      <motion.path d="m9 12 2 2 4-4" variants={tick} />
    </Frame>
  );
}

export function AnimatedUsers(props: IconProps) {
  const repeat = useRepeat();
  const bob = (delay: number): Variants => ({
    rest: { y: 0 },
    active: { y: [0, -2, 0], transition: { duration: 0.45, delay, ...repeat } },
  });
  return (
    <Frame {...props}>
      <motion.g variants={bob(0)}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
      </motion.g>
      <motion.g variants={bob(0.12)}>
        <path d="M16 4.2a3.5 3.5 0 0 1 0 7.6M18 14.2a5 5 0 0 1 3 4.6V20" />
      </motion.g>
    </Frame>
  );
}

export function AnimatedListCheck(props: IconProps) {
  const a = useDraw(0, 0.3);
  const b = useDraw(0.15, 0.3);
  const c = useDraw(0.3, 0.3);
  return (
    <Frame {...props}>
      <motion.path d="m3.5 6 1.5 1.5 3-3" variants={a} />
      <motion.path d="m3.5 12 1.5 1.5 3-3" variants={b} />
      <motion.path d="m3.5 18 1.5 1.5 3-3" variants={c} />
      <path d="M11 6h9.5M11 12h9.5M11 18h9.5" />
    </Frame>
  );
}

export function AnimatedBolt(props: IconProps) {
  const repeat = useRepeat();
  return (
    <Frame {...props}>
      <motion.path
        d="M13 3 5 13.5h6L10.5 21 19 10.5h-6L13 3Z"
        variants={{
          rest: { opacity: 1, scale: 1 },
          active: { opacity: [1, 0.3, 1, 0.5, 1], scale: [1, 1.08, 1], transition: { duration: 0.6, ...repeat } },
        }}
        style={{ transformBox: "fill-box", originX: "50%", originY: "50%" }}
      />
    </Frame>
  );
}

/** The mascot: a bumblebee whose wings beat. Brand moments only. */
export function AnimatedBee(props: IconProps) {
  const repeat = useRepeat();
  const wing = (dir: 1 | -1): Variants => ({
    rest: { rotate: 0 },
    active: {
      rotate: [0, -22 * dir, 0, -22 * dir, 0],
      transition: { duration: 0.35, ease: "easeInOut", ...repeat, repeatDelay: repeat.repeat ? 0.1 : 0 },
    },
  });
  return (
    <Frame {...props}>
      <motion.g
        variants={{
          rest: { y: 0 },
          active: {
            y: [0, -1.5, 0, 1, 0],
            transition: { duration: 1.2, ease: "easeInOut", ...repeat, repeatDelay: 0 },
          },
        }}
      >
        <motion.ellipse
          cx="9"
          cy="7.5"
          rx="3"
          ry="4"
          style={{ originX: "100%", originY: "100%", transformBox: "fill-box" }}
          variants={wing(1)}
        />
        <motion.ellipse
          cx="15"
          cy="7.5"
          rx="3"
          ry="4"
          style={{ originX: "0%", originY: "100%", transformBox: "fill-box" }}
          variants={wing(-1)}
        />
        <ellipse cx="12" cy="15" rx="5" ry="5.5" className="fill-primary" />
        <path d="M7.4 13.5h9.2M7.4 16.5h9.2" />
        <path d="M12 20.5v1.5" />
      </motion.g>
    </Frame>
  );
}
