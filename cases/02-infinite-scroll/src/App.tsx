import { useEffect, useState, useSyncExternalStore } from 'react'
import { probeStore, resetProbe } from './probe'
import { ListA } from './variants/A'
import { ListB } from './variants/B'
import { ListC } from './variants/C'

type Variant = 'a' | 'b' | 'c'

const VARIANTS: { id: Variant; label: string; note: string }[] = [
  { id: 'a', label: 'A 그대로', note: '더 보기마다 모든 카드가 다시 그려지고, 카드마다 matchMedia를 세 번 만듭니다.' },
  { id: 'b', label: 'B 고침', note: 'React.memo · 안정된 props · 공유 미디어쿼리 훅. 새로 온 20장만 그립니다.' },
  { id: 'c', label: 'C 가상 스크롤', note: 'B의 카드 가운데 화면 근처 줄만 DOM에 둡니다. 비교용입니다.' },
]

const LISTS = { a: ListA, b: ListB, c: ListC }

const fromUrl = (): Variant => {
  const v = new URLSearchParams(location.search).get('v')
  return v === 'b' || v === 'c' ? v : 'a'
}

function Readout() {
  const samples = useSyncExternalStore(probeStore.subscribe, probeStore.get)
  const last = samples.at(-1)
  const sum = samples.reduce((s, x) => s + x.ms, 0)
  return (
    <p className="readout" aria-live="polite">
      {last ? (
        <>
          클릭 {samples.length}번 · 마지막 <b>{Math.round(last.ms)} ms</b> · 합계 <b>{Math.round(sum)} ms</b>
        </>
      ) : (
        <>더 보기를 누르면 클릭부터 다음 페인트까지 걸린 시간을 여기 적습니다.</>
      )}
    </p>
  )
}

export function App() {
  const [variant, setVariant] = useState<Variant>(fromUrl)
  useEffect(() => resetProbe(variant), [variant])
  const choose = (v: Variant) => {
    const q = new URLSearchParams(location.search)
    q.set('v', v)
    history.replaceState(null, '', `${location.pathname}?${q}`)
    window.scrollTo(0, 0)
    setVariant(v)
  }
  const List = LISTS[variant]
  return (
    <>
      <header className="top">
        <div className="title">
          <h1>무한 스크롤 상품 목록</h1>
          <p>jank-lab 사례 2 · 목록이 길어질수록 느려지는 문제를 재현합니다</p>
        </div>
        <fieldset className="switch">
          <legend className="sr-only">변형</legend>
          {VARIANTS.map((x) => (
            <label key={x.id} data-on={variant === x.id || undefined}>
              <input type="radio" name="variant" value={x.id} checked={variant === x.id} onChange={() => choose(x.id)} />
              {x.label}
            </label>
          ))}
        </fieldset>
        <p className="note">{VARIANTS.find((x) => x.id === variant)!.note}</p>
        <Readout />
      </header>
      <main>
        <List key={variant} />
      </main>
    </>
  )
}
