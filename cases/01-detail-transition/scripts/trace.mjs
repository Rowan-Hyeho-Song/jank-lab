// One traced opening per variant (A and B by default), for the timeline figure in the README.
//
// atrace (the same kernel and app trace points Perfetto records) runs for a few seconds while the script taps a
// product card once. From the trace it keeps only this app's own threads: when the UI thread, RenderThread and the
// JS thread were running (sched_switch), and the UI thread's frames (Choreographer#doFrame). Nothing about other
// apps on the phone is kept. Times are ms from the tap.
//
//   npm run trace          (the app must be installed: npm run build && adb install ..., or measure.mjs --keep)

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ADB, PKG, SERIAL_ARGS, centreOf, launch, requireAwakeAndUnlocked, requireDevice, sh, sleep, tapInApp } from './adb.mjs'

const VARIANTS = (process.env.VARIANTS ?? 'a,b').split(',')
const WINDOW = [-60, 1000]

function atrace(seconds) {
  return new Promise((resolve, reject) => {
    const p = spawn(ADB, [...SERIAL_ARGS, 'shell', 'atrace', '-t', String(seconds), '-b', '65536', 'gfx', 'view', 'input', 'sched', '-a', PKG])
    let out = ''
    p.stdout.on('data', (d) => (out += d))
    p.on('error', reject)
    p.on('close', () => resolve(out))
  })
}

const LINE = /^\s*(.+?)-(\d+)\s+(?:\(\s*[\d-]+\)\s+)?\[\d+\]\s+\S+\s+([\d.]+):\s+(\w+):\s+(.*)$/

function parse(text, pid, tids) {
  const run = Object.fromEntries(Object.keys(tids).map((k) => [k, []]))
  const since = {}
  const byTid = Object.fromEntries(Object.entries(tids).map(([k, t]) => [t, k]))
  const frames = []
  const inputs = []
  const open = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(LINE)
    if (!m) continue
    const [, , tidS, tsS, ev, body] = m
    const ts = Number(tsS) * 1000
    if (ev === 'sched_switch') {
      const prev = Number(body.match(/prev_pid=(\d+)/)?.[1])
      const next = Number(body.match(/next_pid=(\d+)/)?.[1])
      if (byTid[prev] && since[prev] != null) {
        run[byTid[prev]].push([since[prev], ts])
        since[prev] = null
      }
      if (byTid[next]) since[next] = ts
    } else if (ev === 'tracing_mark_write' && Number(tidS) === pid) {
      const b = body.match(/^B\|\d+\|(.*)$/)
      if (b) open.push({ name: b[1].trim(), ts })
      else if (/^E\|?/.test(body) && open.length) {
        const s = open.pop()
        if (s.name.startsWith('Choreographer#doFrame') && !open.some((o) => o.name.startsWith('Choreographer#doFrame'))) frames.push([s.ts, ts])
        // the tap is its release: that is when the app acts (onPress)
        if (/^dispatchInputEvent MotionEvent.*UP/.test(s.name)) inputs.push(s.ts)
      }
    }
  }
  return { run, frames, inputs }
}

async function once(variant) {
  requireAwakeAndUnlocked()
  await launch(variant)
  const card = centreOf('card-0')
  tapInApp(card.x, card.y)
  await sleep(1800)
  const backButton = centreOf('목록으로')
  tapInApp(backButton.x, backButton.y)
  await sleep(1400)
  const pid = Number(sh(`pidof ${PKG}`).trim())
  const threads = sh(`ps -T -p ${pid} -o TID,CMD`)
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
  const tid = (re) => Number(threads.find(([, name]) => re.test(name ?? ''))?.[0])
  const tids = { ui: pid, render: tid(/^RenderThread$/), js: tid(/^mqt_v_js$|^mqt_js$/) }
  const tracing = atrace(4)
  await sleep(1500)
  tapInApp(card.x, card.y)
  const text = await tracing
  tapInApp(backButton.x, backButton.y)
  await sleep(800)
  const { run, frames, inputs } = parse(text, pid, tids)
  const tap = inputs.find((t) => frames.some(([s]) => s >= t)) ?? inputs[0]
  if (tap == null) throw new Error(`variant ${variant}: no input event in the trace (tracing not allowed for the app?)`)
  const rel = (list) =>
    list
      .map(([s, e]) => [Math.round((s - tap) * 100) / 100, Math.round((e - tap) * 100) / 100])
      .filter(([s, e]) => e >= WINDOW[0] && s <= WINDOW[1])
  const busy = (list) => Math.round(rel(list).reduce((a, [s, e]) => a + Math.max(0, Math.min(e, 500) - Math.max(s, 0)), 0))
  const res = { threads: Object.fromEntries(Object.entries(run).map(([k, v]) => [k, rel(v)])), frames: rel(frames), busyFirst500ms: Object.fromEntries(Object.keys(run).map((k) => [k, busy(run[k])])) }
  console.log(`${variant.toUpperCase()}: busy in the first 500 ms after the tap: UI ${res.busyFirst500ms.ui} ms, RenderThread ${res.busyFirst500ms.render} ms, JS ${res.busyFirst500ms.js} ms; longest frame ${Math.max(...res.frames.map(([s, e]) => e - s)).toFixed(0)} ms`)
  return res
}

requireDevice()
const out = { window: WINDOW, note: 'ms from the tap; thread run intervals (sched_switch) and UI-thread frames (Choreographer#doFrame) of this app only', variants: {} }
for (const v of VARIANTS) out.variants[v] = await once(v)
sh(`am force-stop ${PKG}`)
mkdirSync(new URL('../results/', import.meta.url), { recursive: true })
writeFileSync(new URL('../results/case1-trace.json', import.meta.url), JSON.stringify(out) + '\n')
console.log('-> results/case1-trace.json')
