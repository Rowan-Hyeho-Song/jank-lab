import { memo, useCallback, useState } from 'react'
import { cardMarkup } from '../cardMarkup'
import type { Product } from '../data'
import { useView } from '../useView'
import { MoreButton } from './MoreButton'
import { useList } from './useList'

// B, the fix: a card renders again only when its own props change. The product objects keep their identity across
// pages, the wish handler is one stable function, and the media answers come from one shared subscription.
// "더 보기" then renders the 20 new cards and nothing else.

const Card = memo(function Card({ p, wished, onWish }: { p: Product; wished: boolean; onWish: (id: number) => void }) {
  const view = useView()
  return cardMarkup(p, wished, () => onWish(p.id), view)
})

export function ListB() {
  const { items, more } = useList()
  const [wish, setWish] = useState<ReadonlySet<number>>(new Set())
  const toggle = useCallback(
    (id: number) =>
      setWish((s) => {
        const n = new Set(s)
        if (!n.delete(id)) n.add(id)
        return n
      }),
    [],
  )
  return (
    <>
      <div className="grid">
        {items.map((p) => (
          <Card key={p.id} p={p} wished={wish.has(p.id)} onWish={toggle} />
        ))}
      </div>
      <MoreButton count={items.length} onClick={more} />
    </>
  )
}

export { Card as CardB }
