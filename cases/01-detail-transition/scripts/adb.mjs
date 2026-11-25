// A small adb wrapper shared by the measuring and tracing scripts.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const PKG = 'lab.jank.case1'
export const APK = new URL('../android/app/build/outputs/apk/release/app-release.apk', import.meta.url)

/** adb: $ADB, else the Android SDK's (ANDROID_HOME / LOCALAPPDATA), else whatever is on PATH */
function findAdb() {
  if (process.env.ADB) return process.env.ADB
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb'
  const homes = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk')]
  for (const h of homes) if (h && existsSync(join(h, 'platform-tools', exe))) return join(h, 'platform-tools', exe)
  return 'adb'
}
export const ADB = findAdb()
export const SERIAL_ARGS = process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : []

/** run adb (with -s $ANDROID_SERIAL when set) and return stdout */
export function adb(...args) {
  return execFileSync(ADB, [...SERIAL_ARGS, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}
export const sh = (cmd) => adb('shell', cmd)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function requireDevice() {
  const lines = adb('devices').split('\n').slice(1).filter((l) => /\tdevice\b/.test(l))
  if (!lines.length) throw new Error('adb: no device. Connect a phone (USB or wireless debugging) and try again.')
  if (lines.length > 1 && !process.env.ANDROID_SERIAL) throw new Error('adb: more than one device; set ANDROID_SERIAL.')
}

/** the screen must be on and unlocked: taps go nowhere otherwise */
export function requireAwakeAndUnlocked() {
  const power = sh('dumpsys power | grep -m1 mWakefulness=')
  const win = sh('dumpsys window | grep -m1 isKeyguardShowing=')
  if (!/Awake/.test(power)) throw new Error('the phone screen is off: turn it on and unlock it.')
  if (/isKeyguardShowing=true/.test(win)) throw new Error('the phone is locked: unlock it.')
}

export function deviceInfo() {
  const prop = (k) => sh(`getprop ${k}`).trim()
  return {
    model: prop('ro.product.model'),
    android: prop('ro.build.version.release'),
    sdk: Number(prop('ro.build.version.sdk')),
  }
}

/** open the app on a variant from scratch: stop it, then start it through its deep link */
export async function launch(variant) {
  sh(`am force-stop ${PKG}`)
  await sleep(400)
  // meter=off: the meter's wave (DESIGN.md 4.4) would keep drawing frames and change gfxinfo's count; the layout is the same
  sh(`am start -W -a android.intent.action.VIEW -d 'jankcase1://variant/${variant}?meter=off' ${PKG}`)
  await sleep(2500)
}

/** centre of the view with this accessibility label (content-desc), from a UI dump */
export function centreOf(label) {
  const tmp = '/data/local/tmp/jank-lab-ui.xml'
  sh(`uiautomator dump ${tmp} >/dev/null 2>&1`)
  const xml = sh(`cat ${tmp}`)
  sh(`rm -f ${tmp}`)
  const node = xml.match(new RegExp(`content-desc="${label}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`))
  if (!node) throw new Error(`no view labelled ${label} on screen`)
  const [x1, y1, x2, y2] = node.slice(1).map(Number)
  return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) }
}
