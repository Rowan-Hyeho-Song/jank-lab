import type { MouseEvent } from 'react'

// Click to next paint, measured in the page. The click's own timestamp is the start. A frame callback runs once the
// browser is about to paint the result, and a message posted from it arrives after that paint: that is the end.
// The numbers go to window.__jank, where the measuring script (scripts/measure.mjs) reads them, and to the readout.

export interface Sample {
  /** cards on screen after this click */
  cards: number
  /** click to the paint that shows them, ms */
  ms: number
}

const samples: Sample[] = []
const listeners = new Set<() => void>()
let snapshot: readonly Sample[] = []

declare global {
  interface Window {
    __jank: { samples: Sample[]; ready: boolean; variant: string }
  }
}
window.__jank = { samples, ready: false, variant: '' }

export function markClick(e: MouseEvent, cards: number) {
  const t0 = e.timeStamp
  requestAnimationFrame(() => {
    const ch = new MessageChannel()
    ch.port1.onmessage = () => {
      samples.push({ cards, ms: performance.now() - t0 })
      snapshot = [...samples]
      listeners.forEach((f) => f())
    }
    ch.port2.postMessage(0)
  })
}

export function resetProbe(variant: string) {
  samples.length = 0
  snapshot = []
  window.__jank.variant = variant
  window.__jank.ready = true
  listeners.forEach((f) => f())
}

export const probeStore = {
  subscribe(f: () => void) {
    listeners.add(f)
    return () => void listeners.delete(f)
  },
  get: () => snapshot,
}
