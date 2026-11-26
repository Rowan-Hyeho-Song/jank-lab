import { useSyncExternalStore } from 'react'

// Two times per opening, from the tap: when the push transition ended, and when the review list was laid out.
// Each goes to logcat (release builds still forward console.log to the ReactNativeJS tag) as one parseable line,
// "J1|<variant>|<what>|<ms>", which the measuring script reads, and to the meter's second row (Meter.tsx).

export type What = 'transition' | 'content'

/** `tapped`: an opening has started (the meter shows its steps); the two times arrive as they happen */
let last: Partial<Record<What, number>> & { tapped?: true } = {}
const subs = new Set<() => void>()

export function report(variant: string, what: What, ms: number) {
  console.log(`J1|${variant}|${what}|${ms.toFixed(1)}`)
  last = { ...last, [what]: ms }
  subs.forEach((f) => f())
}

/** a new opening: clear the last one's times */
export const startOpening = () => {
  last = { tapped: true }
  subs.forEach((f) => f())
}

export const useLast = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => void subs.delete(f)
    },
    () => last,
  )
