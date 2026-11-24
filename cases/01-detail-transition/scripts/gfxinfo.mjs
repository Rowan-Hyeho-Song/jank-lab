// Parse `dumpsys gfxinfo <pkg>` (the app-wide block at the top) and add several of them up.
// Counts add; percentiles are taken again from the added-up histograms, the way gfxinfo computes its own.

const num = (s, re) => {
  const m = s.match(re)
  return m ? Number(m[1]) : 0
}

function histogram(line) {
  const h = {}
  for (const [, ms, n] of line.matchAll(/(\d+)ms=(\d+)/g)) h[ms] = Number(n)
  return h
}

export function parseGfxinfo(text) {
  const frameLine = text.match(/^HISTOGRAM:.*$/m)?.[0] ?? ''
  const gpuLine = text.match(/^GPU HISTOGRAM:.*$/m)?.[0] ?? ''
  return {
    frames: num(text, /Total frames rendered: (\d+)/),
    janky: num(text, /Janky frames: (\d+)/),
    missedVsync: num(text, /Number Missed Vsync: (\d+)/),
    slowUiThread: num(text, /Number Slow UI thread: (\d+)/),
    slowBitmapUploads: num(text, /Number Slow bitmap uploads: (\d+)/),
    slowDrawCommands: num(text, /Number Slow issue draw commands: (\d+)/),
    deadlineMissed: num(text, /Number Frame deadline missed: (\d+)/),
    hist: histogram(frameLine.replace(/^HISTOGRAM:/, '')),
    gpuHist: histogram(gpuLine.replace(/^GPU HISTOGRAM:/, '')),
  }
}

const addHist = (a, b) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  return out
}

export function sum(list) {
  const keys = ['frames', 'janky', 'missedVsync', 'slowUiThread', 'slowBitmapUploads', 'slowDrawCommands', 'deadlineMissed']
  const out = Object.fromEntries(keys.map((k) => [k, list.reduce((s, x) => s + x[k], 0)]))
  out.hist = list.reduce((h, x) => addHist(h, x.hist), {})
  out.gpuHist = list.reduce((h, x) => addHist(h, x.gpuHist), {})
  return out
}

/** the p-th percentile (0..100) of a histogram {ms: count} */
export function percentile(hist, p) {
  const rows = Object.entries(hist)
    .map(([ms, n]) => [Number(ms), n])
    .sort((a, b) => a[0] - b[0])
  const total = rows.reduce((s, [, n]) => s + n, 0)
  if (!total) return null
  const want = (p / 100) * total
  let seen = 0
  for (const [ms, n] of rows) {
    seen += n
    if (seen >= want) return ms
  }
  return rows.at(-1)[0]
}

/** the numbers the README reports, from an added-up block */
export function summarize(s) {
  return {
    frames: s.frames,
    jankyPct: s.frames ? Math.round((s.janky / s.frames) * 10000) / 100 : 0,
    p50: percentile(s.hist, 50),
    p90: percentile(s.hist, 90),
    p95: percentile(s.hist, 95),
    p99: percentile(s.hist, 99),
    missedVsync: s.missedVsync,
    slowUiThread: s.slowUiThread,
    slowBitmapUploads: s.slowBitmapUploads,
    slowDrawCommands: s.slowDrawCommands,
    deadlineMissed: s.deadlineMissed,
    gpuP50: percentile(s.gpuHist, 50),
    gpuP90: percentile(s.gpuHist, 90),
    gpuP99: percentile(s.gpuHist, 99),
  }
}
