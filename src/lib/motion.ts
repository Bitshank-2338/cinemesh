import type { Variants, Transition } from 'framer-motion'

// ─── Transitions ────────────────────────────────────────────────
export const springFast: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.8,
}

export const springBase: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 28,
  mass: 1,
}

export const springSlow: Transition = {
  type: 'spring',
  stiffness: 150,
  damping: 20,
  mass: 1.2,
}

export const easeFast: Transition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1],
}

export const easeBase: Transition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1],
}

export const easeSlow: Transition = {
  duration: 0.45,
  ease: [0.4, 0, 0.2, 1],
}

// ─── Shared Variants ────────────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: easeBase },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: easeBase },
}

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  visible: { opacity: 1, y: 0, transition: easeBase },
}

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: { opacity: 1, x: 0, transition: easeBase },
}

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: easeBase },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: springBase },
}

export const scaleInFast: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: springFast },
}

export const slideUp: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: { y: 0, opacity: 1, transition: springBase },
  exit: { y: '100%', opacity: 0, transition: easeBase },
}

// ─── Container Stagger ──────────────────────────────────────────
export const staggerContainer = (
  stagger = 0.08,
  delayChildren = 0
): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
})

export const staggerFast = staggerContainer(0.05, 0)
export const staggerBase = staggerContainer(0.08, 0.1)
export const staggerSlow = staggerContainer(0.12, 0.2)

// ─── Page Transitions ────────────────────────────────────────────
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
}

// ─── Modal Variants ──────────────────────────────────────────────
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springBase },
  exit:    { opacity: 0, scale: 0.96, y: 8, transition: easeFast },
}

// ─── Hero Section ────────────────────────────────────────────────
export const heroTitle: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      delay: i * 0.1,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
}

export const heroOrb: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
  },
}

// ─── Card Hover ──────────────────────────────────────────────────
export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.015,
    y: -4,
    transition: springFast,
  },
}

// ─── Icon Button ─────────────────────────────────────────────────
export const iconTap = {
  tap: { scale: 0.9 },
  hover: { scale: 1.08 },
}
