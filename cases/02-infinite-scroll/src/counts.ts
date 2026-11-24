// Counters for the diagnosis: how many cards rendered and how many MediaQueryLists were made since the last reset.
// Plain increments, cheap enough not to move the timings; the measuring script reads them per run.

export const counts = { cardRenders: 0, matchMedia: 0, subscribes: 0 }

declare global {
  interface Window {
    __counts: typeof counts
  }
}
window.__counts = counts

export function resetCounts() {
  counts.cardRenders = 0
  counts.matchMedia = 0
  counts.subscribes = 0
}
