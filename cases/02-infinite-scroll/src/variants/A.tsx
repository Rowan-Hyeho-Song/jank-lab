import { useState } from 'react'
import { cardMarkup } from '../cardMarkup'
import type { Product } from '../data'
import { useMediaQuery } from '../useMediaQueryPerCard'
import { QUERIES } from '../view'
import { MoreButton } from './MoreButton'
import { useList } from './useList'

// A, as it was: nothing stops a card from rendering again. Each "더 보기" re-renders every card on the list (no memo,
// and a new onWish function per card per render), and every card asks its three media questions itself.

function Card({ p, wished, onWish }: { p: Product; wished: boolean; onWish: () => void }) {
  const compact = useMediaQuery(QUERIES.compact)
  const hover = useMediaQuery(QUERIES.hover)
  const wide = useMediaQuery(QUERIES.wide)
  return cardMarkup(p, wished, onWish, { compact, hover, wide })
}

export function ListA() {
  const { items, more } = useList()
  const [wish, setWish] = useState<ReadonlySet<number>>(new Set())
  const toggle = (id: number) =>
    setWish((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })
  return (
    <>
      <div className="grid">
        {items.map((p) => (
          <Card key={p.id} p={p} wished={wish.has(p.id)} onWish={() => toggle(p.id)} />
        ))}
      </div>
      <MoreButton count={items.length} onClick={more} />
    </>
  )
}
