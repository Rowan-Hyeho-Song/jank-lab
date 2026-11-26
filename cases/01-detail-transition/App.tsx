import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, BackHandler, Easing, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRODUCTS } from './src/data'
import { DetailScreen } from './src/DetailScreen'
import { BAR, C, METER, RATIO, type Rect } from './src/layout'
import { ListScreen } from './src/ListScreen'
import { PHOTOS } from './src/photos'
import { report, startOpening } from './src/timing'
import { Top } from './src/Top'
import { getVariant, listenForVariantLinks, type Variant } from './src/variant'

// The list <-> detail transition (DESIGN.md 4.2), 340 ms each way: the tapped card's picture grows from its place in
// the grid into the detail screen's hero, and shrinks back on closing. One copy of the picture, drawn at hero size
// with square corners, lies over both screens and is moved with translate + scale.
//
// One clock M drives everything on the native driver: opening runs it 0 -> 1, closing 1.001 -> 2 (it rests at 1 while
// the detail screen is open and at 2 while the list is). Every binding is made once, when the detail screen opens, so
// closing is only "start the clock": no React render, no mount, no picture to decode before the first frame.
//
// The moving frame holds the picture twice, square-cornered below and round on top; fading the round one turns the
// corner (borderRadius cannot run on the native driver), always in the same place.
//
//   opening (0 -> 1)                                 closing (1.001 -> 2)
//   0        the card picture hides, the frame       0        the real hero hides, the frame shows in its place
//            (looking just like it) takes its place  0-220    detail text fades, sinks 16
//   0-150    round picture fades: corners 12 -> 0    140-340  detail background fades
//   0-200    detail background fades in              0-340    the frame shrinks back to the card
//   120-340  detail text rises 16 -> 0, fades in     190-340  round picture comes back: corners 0 -> 12
//   0-340    the frame grows into the hero's place   340      the card picture shows, the frame hides
//   340      the real hero shows, the frame hides: the "transition end" that B and E wait for
//
// The UI thread draws every frame, so whatever else holds the UI thread (creating and laying out native views) holds
// the picture too. D has no transition. With reduce motion, or a hero scrolled out of sight, it is a 200 ms fade.

const MS = 340
const FADE_MS = 200
/** where closing starts on the clock: just past 1, so the open-at-rest values (copy hidden, hero shown) differ */
const C0 = 1.001
const open_ = (ms: number) => ms / MS
const close_ = (ms: number) => C0 + (ms / MS) * (2 - C0)
/** Easing.out(Easing.poly(4)) as a table: the native driver interpolates linearly between these points */
const T = Array.from({ length: 33 }, (_, i) => i / 32)
const E = T.map((t) => Easing.out(Easing.poly(4))(t))

type Open = { id: number; t0: number; variant: Variant; from: Rect }

function Stack() {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState<Open | null>(null)
  const [lastId, setLastId] = useState<number | null>(null)
  const [settled, setSettled] = useState(false)
  const [fade, setFade] = useState(false)
  const [reduce, setReduce] = useState(false)
  const M = useRef(new Animated.Value(2)).current
  const shift = useRef(new Animated.Value(0)).current
  const scrollY = useRef(0)
  const phase = useRef<'idle' | 'opening' | 'open' | 'closing'>('idle')
  // On Android the native animated module runs queued operations ("start this animation") only when Fabric next
  // dispatches a mount. Closing changes no view, so its start waited ~70 ms for some unrelated mount. After every
  // start, `kick` moves one invisible pixel, which is a mount. It waits one macrotask: Animated sends its queue to
  // native with setImmediate, and the mount has to come after that.
  const [kick, setKick] = useState(0)
  const flush = useCallback(() => void setTimeout(() => setKick((k) => k + 1), 0), [])

  useEffect(listenForVariantLinks, [])
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => sub.remove()
  }, [])

  // the hero starts under the fixed bar and meter (DESIGN.md 4.4)
  const hero: Rect = { x: 0, y: insets.top + BAR + METER, w: width, h: width * RATIO }

  const onOpen = useCallback(
    (id: number, t0: number, from: Rect) => {
      if (phase.current !== 'idle') return
      phase.current = 'opening'
      M.setValue(0)
      shift.setValue(0)
      scrollY.current = 0
      setFade(reduce)
      setSettled(false)
      setOpen({ id, t0, variant: getVariant(), from })
      setLastId(id)
      startOpening()
    },
    [reduce, M, shift],
  )
  const openRef = useRef(onOpen)
  openRef.current = onOpen
  // one function for the list's whole life, so its cards (memo) do not render again
  const onOpenStable = useCallback((id: number, t0: number, from: Rect) => openRef.current(id, t0, from), [])

  // the opening clock starts once the detail screen and the copy are mounted
  useEffect(() => {
    if (!open || phase.current !== 'opening') return
    const done = () => {
      report(open.variant, 'transition', performance.now() - open.t0)
      phase.current = 'open'
      // the meter's "전환 끝" number commits and paints first; B and E mount their reviews from the next frame, so the
      // number is not held back by that long mount (DESIGN.md 4.4: each step's number arrives on its own frame)
      requestAnimationFrame(() => setSettled(true))
    }
    if (open.variant === 'd') {
      M.setValue(1)
      flush()
      done()
      return
    }
    Animated.timing(M, { toValue: 1, duration: fade ? FADE_MS : MS, easing: Easing.linear, useNativeDriver: true }).start(done)
    flush()
  }, [open, fade, M, flush])

  const closed = useCallback(() => {
    phase.current = 'idle'
    setOpen(null)
    setFade(false)
  }, [])

  const startClosing = useCallback(
    (ms: number) => {
      M.setValue(C0)
      Animated.timing(M, { toValue: 2, duration: ms, easing: Easing.linear, useNativeDriver: true }).start(closed)
      flush()
    },
    [M, closed, flush],
  )

  const onBack = useCallback(() => {
    if (!open || phase.current !== 'open') return
    phase.current = 'closing'
    if (open.variant === 'd') {
      M.setValue(2)
      closed()
      return
    }
    // the hero scrolled out of sight: a fade instead (this one path renders first, to bind the fade)
    if (!fade && scrollY.current >= hero.h) {
      setFade(true)
      return
    }
    // the copy starts where the hero is now
    shift.setValue(-scrollY.current)
    startClosing(fade ? FADE_MS : MS)
  }, [open, fade, hero.h, M, shift, closed, startClosing])

  // the fade fallback above: start once the fade bindings are in
  useEffect(() => {
    if (fade && phase.current === 'closing') startClosing(FADE_MS)
  }, [fade, startClosing])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack()
      return true
    })
    return () => sub.remove()
  }, [open, onBack])

  const moving = !!open && open.variant !== 'd' && !fade
  const from = open?.from
  // all bindings, made once per opening
  const v = useMemo(() => {
    const map = (input: number[], output: number[]) => M.interpolate({ inputRange: input, outputRange: output, extrapolate: 'clamp' })
    if (!moving || !from) {
      return {
        copy: null,
        hero: map([0, 2], [1, 1]),
        card: map([0, 2], [1, 1]),
        background: map([0, 1, C0, 2], [0, 1, 1, 0]),
        textOpacity: map([0, 1, C0, 2], [0, 1, 1, 0]),
        textY: map([0, 2], [0, 0]),
      }
    }
    const pos = map([...T, ...T.map((t) => C0 + t * (2 - C0))], [...E, ...E.map((e) => 1 - e)])
    return {
      copy: {
        // the frame shows from the first frame of opening until it rests (hero shown), and for all of closing until
        // the frame that matches the card exactly
        opacity: map([0, 0.999, 1, C0, 1.9999, 2], [1, 1, 0, 1, 1, 0]),
        // the round-cornered picture on top: 1 -> 0 in 0-150 ms of opening, 0 -> 1 in 190-340 ms of closing
        round: map([0, open_(150), 1, C0, close_(190), 2], [1, 0, 0, 0, 0, 1]),
        radius: (12 * hero.w) / from.w,
        x: pos.interpolate({ inputRange: [0, 1], outputRange: [from.x + from.w / 2 - (hero.x + hero.w / 2), 0] }),
        y: Animated.add(pos.interpolate({ inputRange: [0, 1], outputRange: [from.y + from.h / 2 - (hero.y + hero.h / 2), 0] }), shift),
        scale: pos.interpolate({ inputRange: [0, 1], outputRange: [from.w / hero.w, 1] }),
      },
      hero: map([0, 0.999, 1, C0, 2], [0, 0, 1, 0, 0]),
      // the card picture hides on the first frame (the frame looks exactly like it) and shows again only when closing ends
      card: map([0, 1, C0, 1.9999, 2], [0, 0, 0, 0, 1]),
      background: map([0, open_(200), 1, close_(140), 2], [0, 1, 1, 1, 0]),
      textOpacity: map([0, open_(120), 1, C0, close_(220), 2], [0, 0, 1, 1, 0, 0]),
      textY: map([0, open_(120), 1, C0, close_(220), 2], [16, 16, 0, 0, 16, 16]),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, from, width, insets.top])

  return (
    <>
      <View collapsable={false} pointerEvents="none" style={[s.kick, { left: kick % 2 }]} />
      <ListScreen onOpen={onOpenStable} hiddenId={lastId} hiddenOpacity={v.card} />
      {open && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.background }]}>
          <DetailScreen
            id={open.id}
            t0={open.t0}
            variant={open.variant}
            settled={settled}
            heroOpacity={v.hero}
            onScrollY={(y) => (scrollY.current = y)}
            text={{ opacity: v.textOpacity, translateY: v.textY }}
          />
        </Animated.View>
      )}
      {open && v.copy && (
        // two layers, so the move and the size never mix: the outer one only moves (screen units), the inner picture
        // only scales about its own centre (in one transform list the move came out scaled on Android)
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: hero.x, top: hero.y, width: hero.w, height: hero.h, opacity: v.copy.opacity, transform: [{ translateX: v.copy.x }, { translateY: v.copy.y }] }}
        >
          {/* two of the same picture: square-cornered below, round on top (12 at card size); the fade between them
              turns the corner, inside the moving frame, so the two never part */}
          {/* each picture scales itself (a scaling wrapper view scaled from its corner on Android) */}
          <Animated.Image
            source={PHOTOS[PRODUCTS[open.id].photo]}
            resizeMode="cover"
            style={[s.layer, { width: hero.w, height: hero.h, transform: [{ scale: v.copy.scale }] }]}
          />
          <Animated.Image
            source={PHOTOS[PRODUCTS[open.id].photo]}
            resizeMode="cover"
            style={[s.layer, { width: hero.w, height: hero.h, borderRadius: v.copy.radius, opacity: v.copy.round, transform: [{ scale: v.copy.scale }] }]}
          />
        </Animated.View>
      )}
      {/* the bar and the meter, above everything, never moving (Top.tsx) */}
      <Top detail={open !== null} onBack={onBack} reduce={reduce} />
    </>
  )
}

const s = StyleSheet.create({
  kick: { position: 'absolute', top: 0, width: 1, height: 1, opacity: 0 },
  layer: { position: 'absolute', top: 0, left: 0 },
})

export default function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <Stack />
    </SafeAreaProvider>
  )
}
