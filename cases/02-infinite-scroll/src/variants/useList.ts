import { useState, type MouseEvent } from 'react'
import { PAGE, page, type Product } from '../data'
import { markClick } from '../probe'

/** the list and its "더 보기", the same in every variant: one page more per click, appended to the end */
export function useList() {
  const [items, setItems] = useState<Product[]>(() => page(0))
  const more = (e: MouseEvent) => {
    markClick(e, items.length + PAGE)
    setItems((xs) => [...xs, ...page(xs.length / PAGE)])
  }
  return { items, more }
}
