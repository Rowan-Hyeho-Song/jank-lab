import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useView } from '../useView'
import { CardB } from './B'
import { MoreButton } from './MoreButton'
import { useList } from './useList'

// C, for comparison: B's cards, but only the rows near the screen exist in the DOM (window virtualization by rows,
// @tanstack/react-virtual). The grid's column count has to be known in JS here, so it comes from the same shared view.

const columns = (v: { compact: boolean; wide: boolean }) => (v.wide ? 4 : v.compact ? 2 : 3)

export function ListC() {
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
  const view = useView()
  const cols = columns(view)
  const rows = Math.ceil(items.length / cols)
  const box = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => setTop(box.current ? box.current.getBoundingClientRect().top + window.scrollY : 0), [])
  const v = useWindowVirtualizer({ count: rows, estimateSize: () => (view.compact ? 330 : 420), overscan: 2, scrollMargin: top })
  return (
    <>
      <div ref={box} className="vbox" style={{ height: v.getTotalSize() }}>
        {v.getVirtualItems().map((r) => (
          <div
            key={r.key}
            ref={v.measureElement}
            data-index={r.index}
            className="grid vrow"
            style={{ transform: `translateY(${r.start - v.options.scrollMargin}px)` }}
          >
            {items.slice(r.index * cols, r.index * cols + cols).map((p) => (
              <CardB key={p.id} p={p} wished={wish.has(p.id)} onWish={toggle} />
            ))}
          </div>
        ))}
      </div>
      <MoreButton count={items.length} onClick={more} />
    </>
  )
}
