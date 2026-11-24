// What a card needs to know about the screen. The three questions are the same in every variant; HOW they are asked
// is the difference: variant A asks them inside every card (useMediaQueryPerCard.ts), B and C share one answer (useView.ts).

export const QUERIES = {
  /** phones: a tighter card, without the brand line and the list price */
  compact: '(max-width: 639px)',
  /** a mouse: the quick-add button shows */
  hover: '(hover: hover)',
  /** wide screens: up to five colour dots instead of three */
  wide: '(min-width: 1024px)',
} as const

export interface View {
  compact: boolean
  hover: boolean
  wide: boolean
}
