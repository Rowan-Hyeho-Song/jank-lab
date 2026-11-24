// README charts from the measurement JSON: a light and a dark SVG of each (the README picks one with <picture>).
//   docs/case2-per-click-{light,dark}.svg   click to paint per "더 보기", against the list length (results/case2-long.json
//                                           when it exists, else results/case2.json)
//   docs/case2-totals-{light,dark}.svg      the standard section (20 -> 180 cards): total time and heap, two panels
// Static images: the README's tables carry every number, so the charts label only the line ends and the bar tips.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => JSON.parse(readFileSync(join(root, 'results', f), 'utf8'))
const std = read('case2.json')
const long = existsSync(join(root, 'results', 'case2-long.json')) ? read('case2-long.json') : null
const out = join(root, 'docs')
mkdirSync(out, { recursive: true })

// colours: the validated default categorical slots 1-3 and neutrals, stepped per mode
const THEMES = {
  light: { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#6f6d68', grid: '#e1e0d9', axis: '#c3c2b7', band: '#f1f0ec', series: { a: '#2a78d6', b: '#eb6834', c: '#1baf7a' } },
  dark: { surface: '#1a1a19', ink: '#f0efec', ink2: '#c3c2b7', muted: '#9a988f', grid: '#2c2c2a', axis: '#383835', band: '#232322', series: { a: '#3987e5', b: '#d95926', c: '#199e70' } },
}
const NAMES = { a: 'A 그대로', b: 'B 고침', c: 'C 가상 스크롤' }
const FONT = `font-family="system-ui, -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"`
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 1 : 0 })

/** clean ticks from 0 to just over max */
function ticks(max, n = 5) {
  const raw = max / n
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

function perClick(t, data) {
  const W = 760, H = 420, L = 56, R = 120, T = 98, B = 50
  const pw = W - L - R, ph = H - T - B
  const S = data.summary
  const xs = S.a.perClick.map((p) => p.cards)
  const x0 = 20, x1 = xs.at(-1)
  const ymax = Math.max(...['a', 'b', 'c'].flatMap((v) => S[v].perClick.map((p) => p.ms)))
  const yt = ticks(ymax)
  const X = (c) => L + ((c - x0) / (x1 - x0)) * pw
  const Y = (ms) => T + ph - (ms / yt.at(-1)) * ph
  const xt = xs.filter((c, i) => xs.length <= 10 || (c - 20) % 80 === 0 || i === xs.length - 1)
  const c = data.conditions
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d" ${FONT}>\n`
  s += `<title id="t">더 보기 한 번에 걸린 시간 (클릭 → 다음 페인트)</title>\n<desc id="d">목록 길이에 따른 클릭부터 페인트까지의 시간. ${['a', 'b', 'c'].map((v) => `${NAMES[v]} ${fmt(S[v].perClick[0].ms)}에서 ${fmt(S[v].perClick.at(-1).ms)} ms`).join(', ')}. 재현 측정값, CPU ${c.cpuThrottle}배 감속, ${c.runsPerVariant}회 중앙값.</desc>\n`
  s += `<rect width="${W}" height="${H}" rx="12" fill="${t.surface}"/>\n`
  s += `<text x="${L}" y="30" font-size="16" font-weight="600" fill="${t.ink}">더 보기 한 번에 걸린 시간 (클릭 → 다음 페인트)</text>\n`
  s += `<text x="${L}" y="50" font-size="12" fill="${t.ink2}">재현 측정값 · CPU ${c.cpuThrottle}배 감속 · ${c.runsPerVariant}회 중앙값 · 20장씩 더 보기</text>\n`
  // the standard section (the first 160 added cards)
  if (x1 > 180) {
    s += `<rect x="${X(20)}" y="${T}" width="${X(180) - X(20)}" height="${ph}" fill="${t.band}"/>\n`
    s += `<text x="${X(20) + 6}" y="${T + 14}" font-size="11" fill="${t.muted}">기본 측정 구간 (+160장)</text>\n`
  }
  for (const v of yt) {
    s += `<line x1="${L}" x2="${L + pw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? t.axis : t.grid}" stroke-width="1"/>\n`
    s += `<text x="${L - 8}" y="${Y(v) + 4}" font-size="11" fill="${t.muted}" text-anchor="end" style="font-variant-numeric: tabular-nums">${fmt(v)}</text>\n`
  }
  for (const cx of xt) s += `<text x="${X(cx)}" y="${T + ph + 18}" font-size="11" fill="${t.muted}" text-anchor="middle">${cx}</text>\n`
  s += `<text x="${L + pw / 2}" y="${H - 10}" font-size="11" fill="${t.muted}" text-anchor="middle">더 보기 뒤 화면의 카드 수 (장)</text>\n`
  s += `<text x="14" y="${T + ph / 2}" font-size="11" fill="${t.muted}" text-anchor="middle" transform="rotate(-90 14 ${T + ph / 2})">ms</text>\n`
  // lines, end dots with a surface ring, end labels (nudged apart when close)
  const ends = []
  for (const v of ['a', 'b', 'c']) {
    const pts = S[v].perClick.map((p) => `${X(p.cards).toFixed(1)},${Y(p.ms).toFixed(1)}`).join(' ')
    s += `<polyline points="${pts}" fill="none" stroke="${t.series[v]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>\n`
    const last = S[v].perClick.at(-1)
    s += `<circle cx="${X(last.cards)}" cy="${Y(last.ms)}" r="4" fill="${t.series[v]}" stroke="${t.surface}" stroke-width="2"/>\n`
    ends.push({ v, y: Y(last.ms), ms: last.ms })
  }
  ends.sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 30) ends[i].y = ends[i - 1].y + 30
  for (const e of ends) {
    s += `<text x="${L + pw + 12}" y="${e.y - 2}" font-size="12" font-weight="600" fill="${t.ink}">${esc(NAMES[e.v])}</text>\n`
    s += `<text x="${L + pw + 12}" y="${e.y + 13}" font-size="11" fill="${t.ink2}">${fmt(e.ms)} ms</text>\n`
  }
  // legend
  let lx = L
  for (const v of ['a', 'b', 'c']) {
    s += `<rect x="${lx}" y="68" width="14" height="4" rx="2" fill="${t.series[v]}"/><text x="${lx + 19}" y="74" font-size="11" fill="${t.ink2}">${esc(NAMES[v])}</text>\n`
    lx += NAMES[v].length * 11 + 34
  }
  return s + '</svg>\n'
}

function totals(t, data) {
  const W = 760, H = 218, T = 70, rowH = 40, labelW = 104, gap = 40
  const pw = (W - 2 * 24 - gap) / 2 - labelW - 56
  const S = data.summary
  const c = data.conditions
  const panels = [
    { title: `+${c.clicks * c.cardsPerClick}장 렌더 합계`, unit: 'ms', key: 'totalMs' },
    { title: 'JS heap (GC 뒤)', unit: 'MB', key: 'heapAfterMB', digits: 1 },
  ]
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d" ${FONT}>\n`
  s += `<title id="t">+160장 렌더 합계와 JS heap</title>\n<desc id="d">${['a', 'b', 'c'].map((v) => `${NAMES[v]} ${fmt(S[v].totalMs)} ms, ${fmt(S[v].heapAfterMB)} MB`).join('; ')}. 재현 측정값.</desc>\n`
  s += `<rect width="${W}" height="${H}" rx="12" fill="${t.surface}"/>\n`
  s += `<text x="24" y="30" font-size="16" font-weight="600" fill="${t.ink}">20장에서 180장까지 (+160장)</text>\n`
  s += `<text x="24" y="50" font-size="12" fill="${t.ink2}">재현 측정값 · CPU ${c.cpuThrottle}배 감속 · ${c.runsPerVariant}회 중앙값 · 짧을수록 좋음</text>\n`
  panels.forEach((p, i) => {
    const ox = 24 + i * ((W - 48 + gap) / 2)
    const max = Math.max(...['a', 'b', 'c'].map((v) => S[v][p.key]))
    s += `<text x="${ox}" y="${T + 14}" font-size="12" font-weight="600" fill="${t.ink2}">${esc(p.title)} (${p.unit})</text>\n`
    ;['a', 'b', 'c'].forEach((v, j) => {
      const y = T + 30 + j * rowH
      const w = Math.max(4, (S[v][p.key] / max) * pw)
      s += `<text x="${ox}" y="${y + 15}" font-size="12" fill="${t.ink}">${esc(NAMES[v])}</text>\n`
      s += `<path d="M${ox + labelW} ${y + 2}h${w - 4}a4 4 0 0 1 4 4v12a4 4 0 0 1 -4 4h${-(w - 4)}z" fill="${t.series[v]}"/>\n`
      s += `<text x="${ox + labelW + w + 6}" y="${y + 16}" font-size="12" fill="${t.ink}" style="font-variant-numeric: tabular-nums">${p.digits ? S[v][p.key].toFixed(p.digits) : fmt(S[v][p.key])}</text>\n`
    })
    s += `<line x1="${ox + labelW}" x2="${ox + labelW}" y1="${T + 26}" y2="${T + 30 + 3 * rowH - 10}" stroke="${t.axis}" stroke-width="1"/>\n`
  })
  return s + '</svg>\n'
}

for (const [mode, t] of Object.entries(THEMES)) {
  writeFileSync(join(out, `case2-per-click-${mode}.svg`), perClick(t, long ?? std))
  writeFileSync(join(out, `case2-totals-${mode}.svg`), totals(t, std))
}
console.log(`charts -> docs/case2-{per-click,totals}-{light,dark}.svg (per click from ${long ? 'case2-long' : 'case2'}.json)`)
