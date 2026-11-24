import { useEffect, useState } from 'react'
import { counts } from './counts'

/**
 * Variant A's media query hook, the way it often gets written: correct on its own, costly in a list. Every call makes a
 * new MediaQueryList (matchMedia in the render body), and because that object is new on every render, the effect
 * unsubscribes and subscribes again on every render too. One card asks three questions, so a list of N cards makes
 * 3N MediaQueryLists and 3N listener swaps every time the list renders.
 */
export function useMediaQuery(query: string): boolean {
  counts.matchMedia++
  const mql = window.matchMedia(query)
  const [matches, setMatches] = useState(mql.matches)
  useEffect(() => {
    counts.subscribes++
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', onChange)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [mql])
  return matches
}
