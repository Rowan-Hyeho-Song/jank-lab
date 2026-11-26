// Made-up products and reviews, the same every time (a seeded generator).

export interface Product {
  id: number
  brand: string
  title: string
  price: number
  photo: number
}

export interface Review {
  id: number
  name: string
  rating: number
  date: string
  text: string
  tags: string[]
  photo: number
  helpful: number
}

/** rows in the detail screen's review list: every one of them is mounted at once (a plain ScrollView) */
export const REVIEW_ROWS = 150

const BRANDS = ['오늘의 결', '바람채', '느린숲', '모노데이', '하루살림', '단정', '포근', '새벽빛']
const ITEMS = ['코튼 셔츠', '린넨 팬츠', '울 카디건', '데님 재킷', '니트 베스트', '저지 원피스', '나일론 후드', '캐시미어 머플러']
const NAMES = ['김*연', '이*준', '박*서', '최*우', '정*아', '강*민', '조*희', '윤*호', '장*린', '임*솔']
const LINES = [
  '생각보다 두께감이 있어서 지금 날씨에 딱 좋아요.',
  '평소 사이즈로 샀는데 살짝 여유 있게 맞습니다.',
  '색이 화면이랑 거의 같아요. 세탁 후에도 줄지 않았어요.',
  '배송이 빨랐고 포장도 깔끔했습니다.',
  '어깨선이 자연스럽게 떨어져서 마음에 들어요.',
  '소재가 부드럽고 보풀이 잘 안 일어납니다.',
]
const TAGS = ['사이즈 보통', '색감 만족', '재구매', '선물용', '두께 적당', '배송 빠름']

/** mulberry32 */
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
/** two different items */
const two = <T,>(r: () => number, xs: readonly T[]): [T, T] => {
  const i = Math.floor(r() * xs.length)
  const j = (i + 1 + Math.floor(r() * (xs.length - 1))) % xs.length
  return [xs[i], xs[j]]
}

export const PRODUCTS: Product[] = Array.from({ length: 24 }, (_, i) => {
  const r = rng(i * 131 + 7)
  return { id: i, brand: pick(r, BRANDS), title: pick(r, ITEMS), price: (19 + Math.floor(r() * 120)) * 1000 - 100, photo: i % 6 }
})

export function reviews(productId: number): Review[] {
  return Array.from({ length: REVIEW_ROWS }, (_, i) => {
    const r = rng(productId * 10007 + i * 31 + 3)
    return {
      id: i,
      name: pick(r, NAMES),
      rating: 3 + Math.floor(r() * 3),
      date: `2026.${String(1 + Math.floor(r() * 11)).padStart(2, '0')}.${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
      text: two(r, LINES).join(' '),
      tags: two(r, TAGS),
      photo: Math.floor(r() * 6),
      helpful: Math.floor(r() ** 2 * 80),
    }
  })
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
