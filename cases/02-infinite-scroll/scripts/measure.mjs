// Case 2 measurement: presses "더 보기" CLICKS times in each variant and records
//   1. click to next paint, ms: measured in the page (src/probe.ts), one sample per click
//   2. JS heap after a forced GC (HeapProfiler.collectGarbage, then Performance.getMetrics JSHeapUsedSize)
//   3. for the diagnosis: card renders, matchMedia calls and listener subscriptions during the clicks (src/counts.ts)
// Fixed conditions: production build, 1280 × 800 at DPR 1, CPU slowed 4× (Emulation.setCPUThrottlingRate) once the
// page has loaded, every run in a fresh browser context, the variants interleaved (A B C A B C ...) so drift hits all alike.
//
//   pnpm measure          5 runs, 8 clicks of 20 cards (20 -> 180 cards), CPU 4×  -> results/case2.json
//   pnpm measure:long     the same with 20 clicks (20 -> 420 cards), for the curve -> results/case2-long.json
//   RUNS=9 CPU=6 pnpm measure
//
// Uses the installed Google Chrome when there is one, else Playwright's Chromium (pnpm exec playwright-core install chromium).

import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const LONG = process.argv.includes('--long')
const RUNS = Number(process.env.RUNS ?? 5)
const CLICKS = Number(process.env.CLICKS ?? (LONG ? 20 : 8))
const CPU = Number(process.env.CPU ?? 4)
const PORT = Number(process.env.PORT ?? 4319)
const OUT = process.env.OUT ?? (LONG ? 'case2-long' : 'case2')
const VIEWPORT = { width: 1280, height: 800 }
const VARIANTS = ['a', 'b', 'c']

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d

let channel = 'Google Chrome'
async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    channel = 'Playwright Chromium'
    return await chromium.launch()
  }
}

async function heapMB(cdp) {
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.collectGarbage')
  const { metrics } = await cdp.send('Performance.getMetrics')
  return metrics.find((m) => m.name === 'JSHeapUsedSize').value / 2 ** 20
}

async function once(browser, url, variant) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: 'light' })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('HeapProfiler.enable')
  await page.goto(`${url}?v=${variant}`)
  await page.waitForFunction((v) => window.__jank?.ready && window.__jank.variant === v, variant)
  await page.waitForTimeout(500)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const heapBefore = await heapMB(cdp)
  await page.evaluate(() => Object.keys(window.__counts).forEach((k) => (window.__counts[k] = 0)))
  for (let i = 1; i <= CLICKS; i++) {
    await page.click('.more-btn')
    await page.waitForFunction((n) => window.__jank.samples.length >= n, i, { timeout: 60_000 })
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(500)
  const counts = await page.evaluate(() => ({ ...window.__counts }))
  const heapAfter = await heapMB(cdp)
  const { samples, dom } = await page.evaluate(() => ({
    samples: window.__jank.samples,
    dom: { nodes: document.getElementsByTagName('*').length, cards: document.querySelectorAll('.card').length },
  }))
  await context.close()
  return {
    samples: samples.map((s) => ({ cards: s.cards, ms: round(s.ms) })),
    totalMs: round(samples.reduce((a, s) => a + s.ms, 0)),
    heapBeforeMB: round(heapBefore, 2),
    heapAfterMB: round(heapAfter, 2),
    counts,
    dom,
  }
}

const server = await preview({ root, preview: { port: PORT, strictPort: true, open: false }, logLevel: 'warn' })
const url = `http://localhost:${PORT}/`
const browser = await launch()
const runs = []
try {
  for (let r = 1; r <= RUNS; r++)
    for (const v of VARIANTS) {
      const res = await once(browser, url, v)
      runs.push({ variant: v, run: r, ...res })
      console.log(`run ${r} ${v.toUpperCase()}: +${CLICKS * 20} cards in ${Math.round(res.totalMs)} ms, heap ${res.heapAfterMB.toFixed(1)} MB, ${res.dom.cards} cards in the DOM`)
    }
} finally {
  await browser.close()
  await server.close()
}

const summary = Object.fromEntries(
  VARIANTS.map((v) => {
    const mine = runs.filter((x) => x.variant === v)
    const med = (f) => median(mine.map(f))
    return [
      v,
      {
        totalMs: round(med((x) => x.totalMs)),
        heapBeforeMB: round(med((x) => x.heapBeforeMB), 2),
        heapAfterMB: round(med((x) => x.heapAfterMB), 2),
        domNodes: med((x) => x.dom.nodes),
        cardsInDom: med((x) => x.dom.cards),
        counts: { cardRenders: med((x) => x.counts.cardRenders), matchMedia: med((x) => x.counts.matchMedia), subscribes: med((x) => x.counts.subscribes) },
        perClick: mine[0].samples.map((s, i) => ({ cards: s.cards, ms: round(med((x) => x.samples[i].ms)) })),
      },
    ]
  }),
)

const out = {
  case: 2,
  measuredAt: new Date().toISOString().slice(0, 10),
  conditions: {
    build: 'vite build (production React)',
    browser: `${channel} ${browser.version()} (headless)`,
    cpuThrottle: CPU,
    viewport: `${VIEWPORT.width}x${VIEWPORT.height} @1x`,
    runsPerVariant: RUNS,
    clicks: CLICKS,
    cardsPerClick: 20,
    startCards: 20,
    statistic: 'median of the runs',
    machine: `${os.cpus()[0]?.model.trim() ?? 'unknown CPU'}, ${os.platform()}`,
  },
  summary,
  runs,
}
mkdirSync(join(root, 'results'), { recursive: true })
writeFileSync(join(root, 'results', `${OUT}.json`), JSON.stringify(out, null, 2) + '\n')
console.log(`\nmedian of ${RUNS} runs:`)
for (const v of VARIANTS) {
  const s = summary[v]
  console.log(`  ${v.toUpperCase()}  ${s.totalMs} ms  heap ${s.heapAfterMB} MB  DOM ${s.domNodes} nodes  card renders ${s.counts.cardRenders}  matchMedia ${s.counts.matchMedia}`)
}
console.log(`-> results/${OUT}.json`)
