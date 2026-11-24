import type { CSSProperties } from 'react'
import { counts } from './counts'
import type { Product } from './data'
import type { View } from './view'

// The card's markup, shared by all three variants so they draw exactly the same DOM. Only who renders it, and how
// often, differs.

const won = new Intl.NumberFormat('ko-KR')

const Star = ({ fill }: { fill: number }) => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="M6 .8 7.6 4.2l3.6.4-2.7 2.5.8 3.6L6 8.9l-3.3 1.8.8-3.6L.8 4.6l3.6-.4z" fill={fill >= 0.5 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="0.8" />
  </svg>
)

export function cardMarkup(p: Product, wished: boolean, onWish: () => void, view: View) {
  counts.cardRenders++
  const final = Math.round((p.price * (1 - p.sale)) / 100) * 100
  const colors = p.colors.slice(0, view.wide ? 5 : 3)
  return (
    <article className="card" data-id={p.id}>
      <div className="thumb" style={{ '--h': p.hue } as CSSProperties}>
        <svg viewBox="0 0 40 50" aria-hidden="true">
          <rect x="11" y="9" width="18" height="30" rx="3" />
          <circle cx="20" cy="9" r="4" />
        </svg>
        {p.badges.length > 0 && (
          <ul className="badges">
            {p.badges.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        <button type="button" className="wish" aria-pressed={wished} aria-label={wished ? '찜 해제' : '찜하기'} onClick={onWish}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
        </button>
      </div>
      <div className="info">
        {!view.compact && <p className="brand">{p.brand}</p>}
        <h3 className="name">{p.name}</h3>
        <p className="price">
          {p.sale > 0 && <b>{Math.round(p.sale * 100)}%</b>}
          <strong>{won.format(final)}원</strong>
          {p.sale > 0 && !view.compact && <s>{won.format(p.price)}원</s>}
        </p>
        <p className="rating">
          <span className="stars" role="img" aria-label={`별점 ${p.rating}`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} fill={Math.max(0, Math.min(1, p.rating - i))} />
            ))}
          </span>
          <span className="reviews">리뷰 {won.format(p.reviews)}</span>
        </p>
        <ul className="colors" aria-label={`색상 ${p.colors.length}가지`}>
          {colors.map((c) => (
            <li key={c} style={{ background: c }} />
          ))}
          {p.colors.length > colors.length && <li className="more">+{p.colors.length - colors.length}</li>}
        </ul>
        {view.hover && (
          <button type="button" className="quick">
            빠른 담기
          </button>
        )}
      </div>
    </article>
  )
}
