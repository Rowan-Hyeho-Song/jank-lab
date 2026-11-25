// One set of layout numbers for both screens: a 16 px edge line, a 12 px grid gap, one picture ratio.

export const EDGE = 16
export const GAP = 12
/** height / width of every product picture (4:5), in the list and as the detail screen's hero */
export const RATIO = 5 / 4
/** the top bar (title; on the detail screen the back button), under the status bar; both screens (DESIGN.md 4.4) */
export const BAR = 52
/** the meter under it (DESIGN.md 4.4): two 28 rows + 2 above and below; fixed on top of everything */
export const METER = 60

export const C = {
  bg: '#f6f5f2',
  surface: '#ffffff',
  text: '#1d1d1f',
  text2: '#4a4842',
  muted: '#6b6962',
  /** placeholders only (a step still to come), never words */
  faint: '#a8a49b',
  line: '#dedad2',
  accent: '#1d1d1f',
  /** DESIGN.md 5: the amber that marks A, the slow one on purpose */
  warn: '#a35a00',
}

export type Rect = { x: number; y: number; w: number; h: number }
