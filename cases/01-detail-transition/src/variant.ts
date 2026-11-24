import { useSyncExternalStore } from 'react'
import { Linking } from 'react-native'

// Which variant runs. The list screen's chips pick it, and so does a deep link (jankcase1://variant/a), which is
// how the measuring script switches without touching the screen.

export type Variant = 'a' | 'b' | 'c' | 'd' | 'e'

export const VARIANTS: { id: Variant; label: string; note: string }[] = [
  { id: 'a', label: 'A 그대로', note: '의도한 끊김: 전환 중에 리뷰 150행을 한꺼번에 마운트합니다' },
  { id: 'b', label: 'B 고침', note: '전환이 끝난 뒤에 리뷰를 마운트합니다' },
  { id: 'c', label: 'C 그리기 줄이기', note: 'A에서 그림자·둥근 모서리·사진을 빼고 memo로 감쌉니다' },
  { id: 'd', label: 'D 애니메이션 빼기', note: 'A에서 전환 애니메이션만 끕니다' },
  { id: 'e', label: 'E 미루고 나누기', note: 'B처럼 전환 뒤에, 한 프레임에 5행씩 나눠 마운트합니다' },
]

let current: Variant = 'b'
const subs = new Set<() => void>()

export function setVariant(v: Variant) {
  if (v === current) return
  current = v
  subs.forEach((f) => f())
}

export const getVariant = () => current

export const useVariant = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => void subs.delete(f)
    },
    () => current,
  )

function fromUrl(url: string | null | undefined) {
  const m = url?.match(/variant\/([abcde])/)
  if (m) setVariant(m[1] as Variant)
}

export function listenForVariantLinks() {
  Linking.getInitialURL().then(fromUrl)
  const sub = Linking.addEventListener('url', (e) => fromUrl(e.url))
  return () => sub.remove()
}
