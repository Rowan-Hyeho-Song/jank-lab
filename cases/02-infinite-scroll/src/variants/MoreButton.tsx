import type { MouseEvent } from 'react'
import { PAGE } from '../data'

export function MoreButton({ count, onClick }: { count: number; onClick: (e: MouseEvent) => void }) {
  return (
    <div className="more">
      <button type="button" className="more-btn" onClick={onClick}>
        {PAGE}개 더 보기
      </button>
      <span className="count">{count}개 보는 중</span>
    </div>
  )
}
