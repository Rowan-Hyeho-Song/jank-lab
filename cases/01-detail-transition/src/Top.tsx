import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BAR, C, EDGE, METER } from './layout'
import { useLast } from './timing'
import { VARIANTS, letter, useMeterOn, useVariant } from './variant'

// The top of both screens (DESIGN.md 4.4), fixed above everything (lists, the detail screen, the moving picture):
//   the bar (52 + the top safe area): where you are; on the detail screen also the way back
//   the meter (60): a wave of seven dots run by the UI thread, and the last opening's step times
// It never moves during a transition. The wave runs on the native driver, so whenever the UI thread is held (A mounting
// its reviews) the seven dots freeze in one shape. With ?meter=off (the measuring scripts) the clock never starts and
// the dots rest at the bottom, so it draws no frames; the layout is the same either way.

const DOTS = 7
const CYCLE_MS = 900
/** one cosine period, trough -> crest -> trough, as 0 -> 1 -> 0 */
const wave = (phase: number) => (1 - Math.cos(2 * Math.PI * phase)) / 2

/** dot i's height of the wave over the clock p (0 -> 1), as a table the native driver can interpolate */
function waveFor(p: Animated.Value, i: number) {
  const shift = i / DOTS
  const at = new Set([0, 1])
  for (let j = 0; j <= 8; j++) at.add(((shift + j / 8) % 1 + 1) % 1)
  const input = [...at].sort((a, b) => a - b)
  return p.interpolate({ inputRange: input, outputRange: input.map((x) => wave((((x - shift) % 1) + 1) % 1)) })
}

function Meter({ reduce }: { reduce: boolean }) {
  const p = useRef(new Animated.Value(0)).current
  // the wave's size: 1 while it runs, 0 when it is off (the dots stay bound to the clock; see App.tsx about unbinding)
  const amp = useRef(new Animated.Value(1)).current
  const meterOn = useMeterOn()
  const running = meterOn && !reduce
  useEffect(() => {
    if (!running) {
      amp.setValue(0)
      p.setValue(0)
      return
    }
    amp.setValue(1)
    const loop = Animated.loop(Animated.timing(p, { toValue: 1, duration: CYCLE_MS, easing: Easing.linear, useNativeDriver: true }))
    loop.start()
    return () => loop.stop()
  }, [running, p, amp])
  const dots = useMemo(
    () =>
      Array.from({ length: DOTS }, (_, i) => {
        const h = Animated.multiply(waveFor(p, i), amp)
        return {
          translateY: h.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
          opacity: h.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
        }
      }),
    [p, amp],
  )
  const variant = useVariant()
  const v = VARIANTS.find((x) => x.id === variant)!
  const last = useLast()
  const label = 'UI 스레드' + (!meterOn ? ' · 꺼짐(측정 중)' : reduce ? ' · 움직임 줄이기로 멈춤' : '')
  const ms = (x: number | undefined) => (x === undefined ? '—' : `${Math.round(x)} ms`)
  const spoken = last.tapped ? `전환 끝 ${last.transition === undefined ? '대기' : `${Math.round(last.transition)} 밀리초`}, 리뷰 표시 ${last.content === undefined ? '대기' : `${Math.round(last.content)} 밀리초`}` : undefined
  return (
    <View style={s.meter}>
      <View style={s.row} importantForAccessibility="no-hide-descendants">
        <Text style={s.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={s.dots}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[s.dot, { left: i * 16, opacity: d.opacity, transform: [{ translateY: d.translateY }] }]} />
          ))}
        </View>
        <View style={[s.box, v.warn && s.boxWarn]}>
          <Text style={[s.boxLetter, v.warn && s.boxLetterWarn]}>{letter(v.id)}</Text>
        </View>
      </View>
      <View style={s.row} accessibilityLiveRegion="polite" accessible accessibilityLabel={spoken}>
        {last.tapped ? (
          <>
            <Text style={[s.step, s.stepOn]}>탭</Text>
            <View style={s.link} />
            <Text style={s.step}>전환 끝 </Text>
            <Text style={s.num}>{ms(last.transition)}</Text>
            <View style={s.link} />
            <Text style={s.step}>리뷰 표시 </Text>
            <Text style={s.num}>{ms(last.content)}</Text>
          </>
        ) : (
          <Text style={s.step}>카드를 누르면 단계별 시간을 잽니다</Text>
        )}
      </View>
    </View>
  )
}

export function Top({ detail, onBack, reduce }: { detail: boolean; onBack: () => void; reduce: boolean }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={s.top} pointerEvents="box-none">
      <View style={[s.bar, { paddingTop: insets.top, height: insets.top + BAR }]}>
        {detail ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="목록으로" onPress={onBack} style={s.back}>
              <View style={s.chevron} />
            </Pressable>
            <Text style={s.title}>상품 상세</Text>
          </>
        ) : (
          <Text style={[s.title, s.titleList]}>상세 화면 전환</Text>
        )}
      </View>
      <Meter reduce={reduce} />
    </View>
  )
}

const s = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: EDGE - 12, backgroundColor: C.surface },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 12, height: 12, marginLeft: 4, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.text, transform: [{ rotate: '45deg' }] },
  title: { marginLeft: 4, fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.text },
  titleList: { marginLeft: 12 },
  meter: { height: METER, paddingVertical: 2, paddingHorizontal: EDGE, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line },
  row: { height: 28, flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.muted },
  dots: { flex: 1, height: 28, marginLeft: 16 },
  dot: { position: 'absolute', top: 14, width: 6, height: 6, borderRadius: 3, backgroundColor: C.text },
  box: { width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: C.text },
  boxWarn: { backgroundColor: C.warn },
  boxLetter: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: C.bg },
  boxLetterWarn: { color: '#ffffff' },
  step: { fontSize: 12, lineHeight: 16, color: C.muted },
  stepOn: { fontWeight: '600', color: C.text },
  num: { minWidth: 52, fontSize: 13, lineHeight: 16, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] },
  link: { width: 12, height: 1, marginHorizontal: 6, backgroundColor: C.line },
})
