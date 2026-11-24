import { useSyncExternalStore } from 'react'
import { counts } from './counts'
import { QUERIES, type View } from './view'

// Variants B and C: one MediaQueryList per question for the whole page, made once. Every card reads the same answer
// object through useSyncExternalStore; it changes (and cards re-render) only when the screen really crosses a breakpoint.

counts.matchMedia += Object.keys(QUERIES).length
counts.subscribes += Object.keys(QUERIES).length
const lists = Object.fromEntries(Object.entries(QUERIES).map(([k, q]) => [k, window.matchMedia(q)])) as Record<keyof View, MediaQueryList>
const read = (): View => ({ compact: lists.compact.matches, hover: lists.hover.matches, wide: lists.wide.matches })

let current = read()
const subscribers = new Set<() => void>()
for (const mql of Object.values(lists))
  mql.addEventListener('change', () => {
    current = read()
    subscribers.forEach((f) => f())
  })

function subscribe(f: () => void) {
  subscribers.add(f)
  return () => void subscribers.delete(f)
}

export const useView = () => useSyncExternalStore(subscribe, () => current)
