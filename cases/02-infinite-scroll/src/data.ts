// Made-up products, the same every time (a seeded generator): the three variants draw exactly the same cards.

export interface Product {
  id: number
  brand: string
  name: string
  /** list price, won */
  price: number
  /** 0 or a discount share (0.05 .. 0.5) */
  sale: number
  /** 0 .. 5 */
  rating: number
  reviews: number
  colors: string[]
  badges: string[]
  /** the placeholder picture's hue */
  hue: number
}

/** cards per "더 보기" */
export const PAGE = 20

const BRANDS = ['오늘의 결', '바람채', '느린숲', '모노데이', '하루살림', '단정', '포근', '새벽빛', '구름결', '담백']
const FITS = ['오버핏', '세미오버', '레귤러', '슬림', '와이드', '크롭', '루즈']
const STUFF = ['코튼', '린넨', '울 블렌드', '저지', '데님', '니트', '나일론', '캐시미어 터치']
const ITEMS = ['셔츠', '티셔츠', '카디건', '팬츠', '스커트', '재킷', '후드', '맨투맨', '원피스', '베스트']
const COLORS = ['#2f2f2f', '#f4f1ea', '#8a9a5b', '#c96f4a', '#3d5a80', '#d9b44a', '#a26769', '#6c757d']
const BADGES = ['무료배송', '오늘출발', '단독', '신상', '한정']

/** mulberry32: a small seeded random */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]

export function product(id: number): Product {
  const r = rng(id * 7919 + 17)
  const nColors = 1 + Math.floor(r() * 5)
  const colors = [...COLORS].sort(() => r() - 0.5).slice(0, nColors)
  const badges = BADGES.filter(() => r() < 0.22).slice(0, 2)
  return {
    id,
    brand: pick(r, BRANDS),
    name: `${pick(r, STUFF)} ${pick(r, FITS)} ${pick(r, ITEMS)}`,
    price: (19 + Math.floor(r() * 180)) * 1000 - 100,
    sale: r() < 0.55 ? Math.round((0.05 + r() * 0.45) * 20) / 20 : 0,
    rating: Math.round((3 + r() * 2) * 10) / 10,
    reviews: 1 + Math.floor(r() ** 3 * 4000),
    colors,
    badges,
    hue: Math.floor(r() * 360),
  }
}

/** page `n` (0-based) of the list */
export const page = (n: number, size = PAGE): Product[] => Array.from({ length: size }, (_, i) => product(n * size + i + 1))
