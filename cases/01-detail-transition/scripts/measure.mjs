// Case 1 measurement on a real Android phone (release build, adb).
//
// For each variant, SETS times (variants interleaved A B C D E A B C D E ...):
//   1. start the app fresh on that variant (deep link), find the first product card, open and close it twice to warm up
//   2. CYCLES times: tap the card -> wait for the transition and the reviews -> `dumpsys gfxinfo <pkg> reset` (the
//      opening's frames) -> back -> wait -> `dumpsys gfxinfo <pkg> reset` (the closing's frames)
//   3. read the app's own timings from logcat: tap -> transition end, tap -> reviews laid out
// The opening blocks of a set are added up (counts add, percentiles come from the added histograms); the whole
// cycle (opening + closing) is kept too. Per variant the README uses the median of the sets.
//
//   npm run measure                 build the release APK, install it, measure, uninstall it, draw the charts
//   SETS=5 CYCLES=30 node scripts/measure.mjs --keep     (keep the app installed afterwards)

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { APK, PKG, adb, centreOf, deviceInfo, launch, requireAwakeAndUnlocked, requireDevice, sh, sleep } from './adb.mjs'
import { parseGfxinfo, sum, summarize } from './gfxinfo.mjs'

const SETS = Number(process.env.SETS ?? 3)
const CYCLES = Number(process.env.CYCLES ?? 30)
const OPEN_WAIT = Number(process.env.OPEN_WAIT ?? 1800)
const CLOSE_WAIT = Number(process.env.CLOSE_WAIT ?? 1400)
const VARIANTS = (process.env.VARIANTS ?? 'a,b,c,d,e').split(',')
const KEEP = process.argv.includes('--keep')

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b)
  if (!s.length) return null
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

async function oneSet(variant) {
  requireAwakeAndUnlocked()
  await launch(variant)
  const card = centreOf('card-0')
  const tap = () => sh(`input tap ${card.x} ${card.y}`)
  // closing is a tap on the screen's back button, as a person would: a key event does not raise the display's
  // refresh rate the way a touch does, and the phone's idle low refresh then delays the first frame of the closing
  tap()
  await sleep(OPEN_WAIT)
  const backButton = centreOf('목록으로')
  const back = () => sh(`input tap ${backButton.x} ${backButton.y}`)
  back()
  await sleep(CLOSE_WAIT)
  tap()
  await sleep(OPEN_WAIT)
  back()
  await sleep(CLOSE_WAIT)
  const since = Number(sh('date +%s').trim())
  sh(`dumpsys gfxinfo ${PKG} reset`)
  const open = []
  const close = []
  for (let i = 0; i < CYCLES; i++) {
    tap()
    await sleep(OPEN_WAIT)
    open.push(parseGfxinfo(sh(`dumpsys gfxinfo ${PKG} reset`)))
    back()
    await sleep(CLOSE_WAIT)
    close.push(parseGfxinfo(sh(`dumpsys gfxinfo ${PKG} reset`)))
  }
  const log = adb('logcat', '-d', '-v', 'epoch', '-s', 'ReactNativeJS:I')
  const times = { transition: [], content: [] }
  for (const m of log.matchAll(/^\s*(\d+)\.\d+.*J1\|([abcde])\|(transition|content)\|([\d.]+)/gm))
    if (Number(m[1]) >= since && m[2] === variant) times[m[3]].push(Number(m[4]))
  const openSum = sum(open)
  return {
    open: summarize(openSum),
    cycle: summarize(sum([openSum, sum(close)])),
    transitionMs: r1(median(times.transition)),
    contentMs: r1(median(times.content)),
    opensLogged: times.content.length,
  }
}

requireDevice()
requireAwakeAndUnlocked()
const device = deviceInfo()
console.log(`device: ${device.model}, Android ${device.android}`)
adb('install', '-r', fileURLToPath(APK))
const sets = []
try {
  for (let s = 1; s <= SETS; s++)
    for (const v of VARIANTS) {
      const res = await oneSet(v)
      sets.push({ variant: v, set: s, ...res })
      const o = res.open
      console.log(
        `set ${s} ${v.toUpperCase()}: janky ${o.jankyPct}% p99 ${o.p99} ms missed vsync ${o.missedVsync} slow UI ${o.slowUiThread} GPU p99 ${o.gpuP99} ms | transition ${res.transitionMs} ms, reviews ${res.contentMs} ms`,
      )
    }
} finally {
  sh(`am force-stop ${PKG}`)
  if (!KEEP) adb('uninstall', PKG)
}

const KEYS = ['frames', 'jankyPct', 'p50', 'p90', 'p95', 'p99', 'missedVsync', 'slowUiThread', 'slowBitmapUploads', 'slowDrawCommands', 'deadlineMissed', 'gpuP50', 'gpuP90', 'gpuP99']
const med = (list, part) => Object.fromEntries(KEYS.map((k) => [k, median(list.map((x) => x[part][k]))]))
const summary = Object.fromEntries(
  VARIANTS.map((v) => {
    const mine = sets.filter((x) => x.variant === v)
    return [v, { open: med(mine, 'open'), cycle: med(mine, 'cycle'), transitionMs: median(mine.map((x) => x.transitionMs)), contentMs: median(mine.map((x) => x.contentMs)) }]
  }),
)

const out = {
  case: 1,
  measuredAt: new Date().toISOString().slice(0, 10),
  conditions: {
    device: `${device.model}, Android ${device.android} (API ${device.sdk})`,
    build: 'release APK (Hermes, New Architecture), arm64-v8a',
    transition: 'list picture -> detail hero, 340 ms each way (native driver), DESIGN.md 4.2',
    close: 'tap on the screen back button',
    meter: 'off',
    reviewRows: 150,
    cyclesPerSet: CYCLES,
    setsPerVariant: SETS,
    openWaitMs: OPEN_WAIT,
    closeWaitMs: CLOSE_WAIT,
    statistic: 'per set: the opening frames of all cycles added up (percentiles from the added histograms); per variant: median of the sets',
    source: 'dumpsys gfxinfo; timings from the app (tap -> transitionEnd, tap -> reviews onLayout) via logcat',
  },
  summary,
  sets,
}
mkdirSync(new URL('../results/', import.meta.url), { recursive: true })
writeFileSync(new URL('../results/case1.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.log('\nmedian of', SETS, 'sets (opening):')
for (const v of VARIANTS) {
  const o = summary[v].open
  console.log(`  ${v.toUpperCase()}  janky ${o.jankyPct}%  p50 ${o.p50} p90 ${o.p90} p99 ${o.p99} ms  missed vsync ${o.missedVsync}  slow UI ${o.slowUiThread}  GPU p50/p99 ${o.gpuP50}/${o.gpuP99} ms  transition ${summary[v].transitionMs} ms  reviews ${summary[v].contentMs} ms`)
}
console.log('-> results/case1.json')
