"use client";

import { IconArrowBackUp, IconCheck, IconMicrophone } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";

const cards = [
  {
    label: "Send revised deck to Infinity",
    tag: "Rolled from yesterday",
    icon: IconArrowBackUp,
    rotate: -4,
    x: "8%",
    y: "18%",
  },
  {
    label: "Call recap: 3 action items found",
    tag: "From a voice note",
    icon: IconMicrophone,
    rotate: 3,
    x: "46%",
    y: "44%",
  },
  { label: "Ship onboarding emails", tag: "Done", icon: IconCheck, rotate: -2, x: "14%", y: "68%" },
];

/**
 * The one orchestrated moment on the auth screens: the loop draws itself,
 * then three of today's cards drop onto it.
 */
export function AuthShowcase() {
  const reduce = useReducedMotion();

  return (
    <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:block">
      <svg
        viewBox="0 0 600 600"
        className="absolute inset-0 size-full opacity-90"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <motion.path
          d="M120 380c0-130 90-230 200-230 96 0 168 76 168 164 0 80-60 144-136 144-68 0-118-50-118-114 0-52 40-92 90-92"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.22}
          strokeWidth={46}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
        />
        <motion.circle
          cx="324"
          cy="352"
          r="26"
          className="fill-primary-foreground"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 14 }}
        />
      </svg>

      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          className="absolute w-72 rounded-2xl bg-card p-4 text-card-foreground shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45)]"
          style={{ left: card.x, top: card.y }}
          initial={reduce ? false : { opacity: 0, y: -40, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: card.rotate }}
          transition={{ delay: 1.7 + index * 0.18, type: "spring", stiffness: 260, damping: 18 }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <card.icon className="size-3.5" stroke={2} />
            {card.tag}
          </div>
          <p className="mt-1.5 font-medium leading-snug">{card.label}</p>
        </motion.div>
      ))}

      <div className="absolute inset-x-10 bottom-10">
        <p className="font-heading text-3xl font-semibold leading-tight tracking-tight text-balance">
          Every day picks up exactly where yesterday left off.
        </p>
      </div>
    </div>
  );
}
