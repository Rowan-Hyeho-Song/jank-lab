// One set of layout numbers for both screens: a 16 px edge line, a 12 px grid gap, one picture ratio.

export const EDGE = 16
export const GAP = 12
/** height / width of every product picture (4:5), in the list and as the detail screen's hero */
export const RATIO = 5 / 4
/** the detail screen's top bar (the back button), under the status bar */
export const BAR = 52

export const C = {
  bg: '#f6f5f2',
  surface: '#ffffff',
  text: '#1d1d1f',
  text2: '#4a4842',
  muted: '#6b6962',
  line: '#dedad2',
  accent: '#1d1d1f',
}

export type Rect = { x: number; y: number; w: number; h: number }
