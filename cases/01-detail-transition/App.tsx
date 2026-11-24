import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { AccessibilityInfo, Animated, BackHandler, Easing, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRODUCTS } from './src/data'
import { DetailScreen } from './src/DetailScreen'
import { BAR, C, RATIO, type Rect } from './src/layout'
import { ListScreen } from './src/ListScreen'
import { PHOTOS } from './src/photos'
import { report } from './src/timing'
import { getVariant, listenForVariantLinks, type Variant } from './src/variant'

// The list <-> detail transition (DESIGN.md 4.2), 340 ms: the tapped card's picture grows from its place in the grid
// into the detail screen's hero, and shrinks back on closing. One copy of the picture, drawn at hero size with square
// corners, is laid over both screens and moved with translate + scale. Everything runs on the native driver from one
// linear clock per direction (`open` 0 -> 1, `close` 0 -> 1), with the ms windows of the design:
//
//   opening                                         closing
//   0-100    copy fades in over the card picture    0-220    detail text fades, sinks 16
//   100      card picture hides                     140-340  detail background fades
//   0-200    detail background fades in             0-340    copy shrinks back to the card
//   120-340  detail text rises 16 -> 0, fades in    240-340  copy fades out over the card picture
//   0-340    copy grows into the hero's place                (the card picture shows the whole time)
//   340      the real hero shows, the copy goes: the "transition end" that B and E wait for
//
// The UI thread draws every frame, so whatever else holds the UI thread (creating and laying out native views) holds
// the picture too. D has no transition; with reduce motion (or a hero scrolled away) it is a 200 ms fade.

const MS = 340
const FADE_MS = 200
const at = (ms: number) => ms / MS
/** Easing.out(Easing.poly(4)) as a table: the native driver interpolates linearly between these points */
const EASE_IN = Array.from({ length: 33 }, (_, i) => i / 32)
const EASE_OUT = EASE_IN.map((t) => Easing.out(Easing.poly(4))(t))

type Open = { id: number; t0: number; variant: Variant; from: Rect }
type Fly = { from: Rect; to: Rect }
type Phase = 'idle' | 'opening' | 'open' | 'closing'

function Stack() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState<Open | null>(null)
  const [lastId, setLastId] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [fly, setFly] = useState<Fly | null>(null)
  const [fade, setFade] = useState(false)
  const [reduce, setReduce] = useState(false)
  const openT = useRef(new Animated.Value(0)).current
  const closeT = useRef(new Animated.Value(1)).current
  const hero = useRef<ComponentRef<typeof View>>(null)

  useEffect(listenForVariantLinks, [])
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => sub.remove()
  }, [])

  const onOpen = useCallback(
    (id: number, t0: number, from: Rect) => {
      if (phase !== 'idle') return
      const variant = getVariant()
      const plain = variant !== 'd' && reduce
      setOpen({ id, t0, variant, from })
      setLastId(id)
      setFade(plain)
      setFly(variant === 'd' || plain ? null : { from, to: { x: 0, y: insets.top + BAR, w: width, h: width * RATIO } })
      setPhase('opening')
    },
    [phase, reduce, insets.top, width],
  )

  // the clocks start once the detail screen and the copy are mounted
  useEffect(() => {
    if (phase !== 'opening' || !open) return
    const done = () => {
      report(open.variant, 'transition', performance.now() - open.t0)
      setFly(null)
      setPhase('open')
    }
    openT.setValue(0)
    if (open.variant === 'd') {
      openT.setValue(1)
      done()
      return
    }
    Animated.timing(openT, { toValue: 1, duration: fade ? FADE_MS : MS, easing: Easing.linear, useNativeDriver: true }).start(done)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'closing') return
    closeT.setValue(0)
    Animated.timing(closeT, { toValue: 1, duration: fade ? FADE_MS : MS, easing: Easing.linear, useNativeDriver: true }).start(() => {
      setFly(null)
      setOpen(null)
      setPhase('idle')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const onBack = useCallback(() => {
    if (!open || phase !== 'open') return
    if (open.variant === 'd') {
      closeT.setValue(1)
      setOpen(null)
      setPhase('idle')
      return
    }
    // back to the card, from wherever the hero is now (the detail screen may have been scrolled); off screen: a fade
    hero.current?.measureInWindow((x, y, w, h) => {
      const onScreen = h > 0 && y + h > 0 && y < height
      const plain = reduce || !onScreen
      setFade(plain)
      setFly(plain ? null : { from: open.from, to: { x, y, w, h } })
      setPhase('closing')
    })
  }, [open, phase, reduce, height, closeT])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack()
      return true
    })
    return () => sub.remove()
  }, [open, onBack])

  // The bindings. The closing ones stay bound after closing (closeT rests at 1): a native-driven prop that is unbound
  // keeps its last native value, so the card picture would stay hidden.
  const closingSide = phase === 'closing' || phase === 'idle'
  const T = closingSide ? closeT : openT
  const ms = (a: number, b: number) => (fade ? [0, 1] : [at(a), at(b)])
  const v = closingSide
    ? {
        pos: T.interpolate({ inputRange: EASE_IN, outputRange: EASE_OUT.map((e) => 1 - e) }),
        copy: T.interpolate({ inputRange: [0, at(240), 1], outputRange: [1, 1, 0] }),
        card: T.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }),
        background: T.interpolate({ inputRange: fade ? [0, 1] : [0, at(140), 1], outputRange: fade ? [1, 0] : [1, 1, 0] }),
        textOpacity: T.interpolate({ inputRange: fade ? [0, 1] : [0, at(220), 1], outputRange: fade ? [1, 0] : [1, 0, 0] }),
        textY: T.interpolate({ inputRange: [0, ms(0, 220)[1], 1], outputRange: fade ? [0, 0, 0] : [0, 16, 16] }),
      }
    : {
        pos: T.interpolate({ inputRange: EASE_IN, outputRange: EASE_OUT }),
        copy: T.interpolate({ inputRange: [0, at(100), 1], outputRange: [0, 1, 1] }),
        card: fly ? T.interpolate({ inputRange: [0, at(100), at(100) + 0.001, 1], outputRange: [1, 1, 0, 0] }) : T.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }),
        background: T.interpolate({ inputRange: fade ? [0, 1] : [0, at(200), 1], outputRange: fade ? [0, 1] : [0, 1, 1] }),
        textOpacity: T.interpolate({ inputRange: fade ? [0, 1] : [0, at(120), 1], outputRange: fade ? [0, 1] : [0, 0, 1] }),
        textY: T.interpolate({ inputRange: [0, ms(120, 340)[0], 1], outputRange: fade ? [0, 0, 0] : [16, 16, 0] }),
      }

  return (
    <>
      <ListScreen onOpen={onOpen} hiddenId={lastId} hiddenOpacity={v.card} />
      {open && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.background }]}>
          <DetailScreen
            id={open.id}
            t0={open.t0}
            variant={open.variant}
            settled={phase === 'open' || phase === 'closing'}
            onBack={onBack}
            heroHidden={fly !== null}
            heroRef={hero}
            text={{ opacity: v.textOpacity, translateY: v.textY }}
          />
        </Animated.View>
      )}
      {open && fly && (
        <Animated.Image
          source={PHOTOS[PRODUCTS[open.id].photo]}
          resizeMode="cover"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: fly.to.x,
            top: fly.to.y,
            width: fly.to.w,
            height: fly.to.h,
            opacity: v.copy,
            transform: [
              { translateX: v.pos.interpolate({ inputRange: [0, 1], outputRange: [fly.from.x + fly.from.w / 2 - (fly.to.x + fly.to.w / 2), 0] }) },
              { translateY: v.pos.interpolate({ inputRange: [0, 1], outputRange: [fly.from.y + fly.from.h / 2 - (fly.to.y + fly.to.h / 2), 0] }) },
              { scale: v.pos.interpolate({ inputRange: [0, 1], outputRange: [fly.from.w / fly.to.w, 1] }) },
            ],
          }}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <Stack />
    </SafeAreaProvider>
  )
}
