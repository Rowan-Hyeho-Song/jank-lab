// README charts from the measurement JSON, a light and a dark SVG of each (the README picks one with <picture>).
//   docs/case1-frames-{light,dark}.svg     the opening, per variant: janky frames %, p99 frame, slow UI thread frames,
//                                          tap -> transition end (with the 340 ms design line); four small panels
//   docs/case1-trace-{light,dark}.svg      one traced opening of A and of B: when the UI thread, RenderThread and the
//                                          JS thread ran, ms from the tap (results/case1-trace.json, when it exists)
//   docs/case1-{frames,trace}-{light,dark}-narrow.svg   the same at 360 wide for phones (site/case-1, <picture> media
//                                          max-width 640px): panels one under another, the subtitle on its own lines
// Static images: the README's tables carry every number, so the charts label only the bar tips.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const read = (f) => JSON.parse(readFileSync(new URL(`../results/${f}`, import.meta.url), 'utf8'))
const data = read('case1.json')
const trace = existsSync(new URL('../results/case1-trace.json', import.meta.url)) ? read('case1-trace.json') : null
const out = new URL('../docs/', import.meta.url)
mkdirSync(out, { recursive: true })

// the validated default categorical slots 1-5 and neutrals, stepped per mode
const THEMES = {
  light: { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#6f6d68', grid: '#e1e0d9', axis: '#c3c2b7', band: '#f1f0ec', series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] },
  dark: { surface: '#1a1a19', ink: '#f0efec', ink2: '#c3c2b7', muted: '#9a988f', grid: '#2c2c2a', axis: '#383835', band: '#232322', series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'] },
}
const NAMES = { a: 'A 그대로', b: 'B 고침', c: 'C 그리기 줄이기', d: 'D 애니메이션 빼기', e: 'E 미루고 나누기' }
const FONT = `font-family="system-ui, -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"`
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const fmt = (n) => (n == null ? '-' : n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 1 : 0 }))
const variants = Object.keys(data.summary)
const colour = (t, v) => t.series['abcde'.indexOf(v)]

function frames(t, narrow = false) {
  const W = narrow ? 360 : 760, panelW = narrow ? 312 : 352, rowH = 30, labelW = narrow ? 112 : 126, top = narrow ? 92 : 74
  const cols = narrow ? 1 : 2
  const panels = [
    { title: '밀린 프레임', unit: '%', get: (v) => data.summary[v].open.jankyPct },
    { title: '99번째 백분위 프레임', unit: 'ms', get: (v) => data.summary[v].open.p99 },
    { title: 'Slow UI thread 프레임 (열기 30회)', unit: '개', get: (v) => data.summary[v].open.slowUiThread },
    { title: '탭 → 전환 끝', unit: 'ms', get: (v) => data.summary[v].transitionMs, ref: 340 },
  ]
  const panelH = 34 + variants.length * rowH + 10
  const H = top + (4 / cols) * panelH + 16
  const c = data.conditions
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d" ${FONT}>\n`
  s += `<title id="t">상세 화면 열기의 프레임</title>\n<desc id="d">${variants.map((v) => `${NAMES[v]}: 밀린 프레임 ${fmt(data.summary[v].open.jankyPct)}%, p99 ${fmt(data.summary[v].open.p99)} ms, 전환 끝 ${fmt(data.summary[v].transitionMs)} ms`).join('; ')}. 재현 측정값.</desc>\n`
  s += `<rect width="${W}" height="${H}" rx="12" fill="${t.surface}"/>\n`
  s += `<text x="24" y="30" font-size="16" font-weight="600" fill="${t.ink}">상세 화면을 여는 동안의 프레임</text>\n`
  const sub = [`재현 측정값 · ${esc(c.device.split(' (')[0])} · 릴리스 빌드`, `열기 ${c.cyclesPerSet}회 × ${c.setsPerVariant}세트 중앙값 · 짧을수록 좋음`]
  if (narrow) sub.forEach((line, i) => (s += `<text x="24" y="${50 + i * 18}" font-size="12" fill="${t.ink2}">${line}</text>\n`))
  else s += `<text x="24" y="50" font-size="12" fill="${t.ink2}">${sub.join(' · ')}</text>\n`
  panels.forEach((p, i) => {
    const ox = 24 + (i % cols) * (panelW + 8)
    const oy = top + Math.floor(i / cols) * panelH
    const pw = panelW - labelW - 50
    const max = Math.max(p.ref ?? 0, ...variants.map(p.get).filter((x) => x != null))
    s += `<text x="${ox}" y="${oy + 14}" font-size="12" font-weight="600" fill="${t.ink2}">${esc(p.title)} (${p.unit})</text>\n`
    variants.forEach((v, j) => {
      const y = oy + 26 + j * rowH
      const val = p.get(v)
      const w = val == null ? 0 : Math.max(4, (val / max) * pw)
      s += `<text x="${ox}" y="${y + 14}" font-size="12" fill="${t.ink}">${esc(NAMES[v])}</text>\n`
      if (w) s += `<path d="M${ox + labelW} ${y + 2}h${w - 4}a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h${-(w - 4)}z" fill="${colour(t, v)}"/>\n`
      s += `<text x="${ox + labelW + w + 6}" y="${y + 15}" font-size="12" fill="${t.ink}" style="font-variant-numeric: tabular-nums">${fmt(val)}</text>\n`
    })
    const axisBottom = oy + 26 + variants.length * rowH - 8
    s += `<line x1="${ox + labelW}" x2="${ox + labelW}" y1="${oy + 22}" y2="${axisBottom}" stroke="${t.axis}" stroke-width="1"/>\n`
    if (p.ref) {
      const rx = ox + labelW + (p.ref / max) * pw
      s += `<line x1="${rx}" x2="${rx}" y1="${oy + 22}" y2="${axisBottom}" stroke="${t.muted}" stroke-width="1" stroke-dasharray="3 3"/>\n`
      s += `<text x="${rx}" y="${oy + 14}" font-size="11" fill="${t.muted}" text-anchor="middle">설계 ${p.ref}</text>\n`
    }
  })
  return s + '</svg>\n'
}

function timeline(t, narrow = false) {
  const W = narrow ? 360 : 760, L = narrow ? 104 : 132, R = narrow ? 32 : 24, top = narrow ? 106 : 70, laneH = 18, laneGap = 8, groupGap = 30
  const step = narrow ? 500 : 200
  const [x0, x1] = trace.window
  const X = (ms) => L + ((Math.min(Math.max(ms, x0), x1) - x0) / (x1 - x0)) * (W - L - R)
  const lanes = [
    ['ui', 'UI 스레드'],
    ['render', 'RenderThread'],
    ['js', 'JS 스레드'],
  ]
  const groups = Object.keys(trace.variants)
  const groupH = lanes.length * (laneH + laneGap) + 22
  const H = top + groups.length * (groupH + groupGap) + 30
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d" ${FONT}>\n`
  s += `<title id="t">탭부터 1초 동안 스레드가 일한 구간</title>\n<desc id="d">${groups.map((g) => `${NAMES[g]}: 탭 뒤 500 ms 동안 UI 스레드 ${trace.variants[g].busyFirst500ms.ui} ms, RenderThread ${trace.variants[g].busyFirst500ms.render} ms 실행`).join('; ')}.</desc>\n`
  s += `<rect width="${W}" height="${H}" rx="12" fill="${t.surface}"/>\n`
  s += `<text x="24" y="30" font-size="16" font-weight="600" fill="${t.ink}">탭부터 1초 동안, 스레드가 일한 구간</text>\n`
  const sub = ['재현 트레이스(atrace, 한 번 열기)', '칠한 곳 = 스레드가 CPU에서 실행 중', '회색 띠 = 설계한 전환 0–340 ms']
  if (narrow) sub.forEach((line, i) => (s += `<text x="24" y="${50 + i * 18}" font-size="12" fill="${t.ink2}">${line}</text>\n`))
  else s += `<text x="24" y="50" font-size="12" fill="${t.ink2}">${sub.join(' · ')}</text>\n`
  groups.forEach((g, gi) => {
    const oy = top + gi * (groupH + groupGap)
    const tr = trace.variants[g]
    s += `<rect x="${X(0)}" y="${oy + 16}" width="${X(340) - X(0)}" height="${groupH - 18}" fill="${t.band}"/>\n`
    s += `<text x="24" y="${oy + 10}" font-size="13" font-weight="600" fill="${t.ink}">${esc(NAMES[g])}</text>\n`
    lanes.forEach(([k, name], li) => {
      const y = oy + 20 + li * (laneH + laneGap)
      s += `<text x="24" y="${y + 13}" font-size="12" fill="${t.ink2}">${name}</text>\n`
      s += `<line x1="${L}" x2="${W - R}" y1="${y + laneH}" y2="${y + laneH}" stroke="${t.grid}" stroke-width="1"/>\n`
      for (const [a, b] of tr.threads[k] ?? []) {
        if (b < x0 || a > x1) continue
        const w = Math.max(0.6, X(b) - X(a))
        s += `<rect x="${X(a).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${laneH}" fill="${t.series[li]}"/>\n`
      }
    })
  })
  const ay = top + groups.length * (groupH + groupGap) - groupGap + 8
  for (let ms = 0; ms <= x1; ms += step) {
    s += `<line x1="${X(ms)}" x2="${X(ms)}" y1="${ay - 4}" y2="${ay}" stroke="${t.axis}"/>\n`
    s += `<text x="${X(ms)}" y="${ay + 14}" font-size="11" fill="${t.muted}" text-anchor="middle">${ms === 0 ? '탭' : `${ms} ms`}</text>\n`
  }
  return s + '</svg>\n'
}

for (const [mode, t] of Object.entries(THEMES)) {
  writeFileSync(new URL(`case1-frames-${mode}.svg`, out), frames(t))
  writeFileSync(new URL(`case1-frames-${mode}-narrow.svg`, out), frames(t, true))
  if (trace) writeFileSync(new URL(`case1-trace-${mode}.svg`, out), timeline(t))
  if (trace) writeFileSync(new URL(`case1-trace-${mode}-narrow.svg`, out), timeline(t, true))
}
console.log(`charts -> docs/case1-frames-{light,dark}[-narrow].svg${trace ? ' and docs/case1-trace-{light,dark}[-narrow].svg' : ''}`)
