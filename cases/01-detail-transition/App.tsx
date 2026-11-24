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

// The list -> detail transition (DESIGN.md 4.2), 340 ms: the tapped card's picture grows from its place in the grid
// into the detail screen's hero. One copy of the picture, drawn at hero size with square corners, is laid over both
// screens and moved with translate + scale; one progress value p (0 -> 1) drives everything on the native driver:
//   0-100 ms   the copy fades in over the round-cornered card picture, which then hides (the corner change never jumps)
//   0-340 ms   the copy moves and grows into the hero's place
//   0-200 ms   the detail screen's background fades in
//   120-340 ms the detail text rises 16 -> 0 and fades in (DetailScreen)
//   340 ms     the real hero shows and the copy goes, in the same frame: the "transition end" that B and E wait for
// Closing runs p back to 0. The UI thread draws every frame of it, so whatever else holds the UI thread (creating
// and laying out native views) holds the picture too. D has no transition; with reduce motion it is a 200 ms fade.

const MS = 340
const FADE_MS = 200
const EASE = Easing.out(Easing.poly(4))
/** p at 100, 120 and 200 ms of the 340 */
const P100 = 100 / MS
const P120 = 120 / MS
const P200 = 200 / MS

type Open = { id: number; t0: number; variant: Variant; from: Rect }
type Fly = { from: Rect; to: Rect }

function Stack() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState<Open | null>(null)
  const [settled, setSettled] = useState(false)
  const [closing, setClosing] = useState(false)
  const [fly, setFly] = useState<Fly | null>(null)
  const [reduce, setReduce] = useState(false)
  const p = useRef(new Animated.Value(0)).current
  const busy = useRef(false)
  const hero = useRef<ComponentRef<typeof View>>(null)

  useEffect(listenForVariantLinks, [])
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => sub.remove()
  }, [])

  const run = (to: 0 | 1, ms: number, done: () => void) => Animated.timing(p, { toValue: to, duration: ms, easing: EASE, useNativeDriver: true }).start(done)

  const onOpen = useCallback(
    (id: number, t0: number, from: Rect) => {
      if (busy.current || open) return
      busy.current = true
      const variant = getVariant()
      setSettled(false)
      setClosing(false)
      setOpen({ id, t0, variant, from })
      const done = () => {
        report(variant, 'transition', performance.now() - t0)
        setFly(null)
        setSettled(true)
        busy.current = false
      }
      if (variant === 'd') {
        p.setValue(1)
        done()
        return
      }
      p.setValue(0)
      if (reduce) return run(1, FADE_MS, done)
      setFly({ from, to: { x: 0, y: insets.top + BAR, w: width, h: width * RATIO } })
      run(1, MS, done)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, reduce, insets.top, width],
  )

  const onBack = useCallback(() => {
    if (!open || busy.current) return
    busy.current = true
    const finish = () => {
      setFly(null)
      setOpen(null)
      setClosing(false)
      busy.current = false
    }
    if (open.variant === 'd') return finish()
    setClosing(true)
    if (reduce) return run(0, FADE_MS, finish)
    // back to the card, from wherever the hero is now (the detail screen may have been scrolled); off screen: a fade
    hero.current?.measureInWindow((x, y, w, h) => {
      const onScreen = h > 0 && y + h > 0 && y < height
      if (!onScreen) return run(0, FADE_MS, finish)
      setFly({ from: open.from, to: { x, y, w, h } })
      run(0, MS, finish)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduce, height])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack()
      return true
    })
    return () => sub.remove()
  }, [open, onBack])

  // the card picture under the copy: shown until 100 ms into opening, shown again for the whole closing
  const cardPhoto = closing ? 1 : p.interpolate({ inputRange: [0, P100, P100 + 0.001, 1], outputRange: [1, 1, 0, 0] })
  const background = reduce ? p : p.interpolate({ inputRange: [0, P200, 1], outputRange: [0, 1, 1] })
  const text = {
    opacity: reduce ? p : p.interpolate({ inputRange: [0, P120, 1], outputRange: [0, 0, 1] }),
    translateY: reduce ? 0 : p.interpolate({ inputRange: [0, P120, 1], outputRange: [16, 16, 0] }),
  }
  return (
    <>
      <ListScreen onOpen={onOpen} hiddenId={open?.id ?? null} hiddenOpacity={cardPhoto} />
      {open && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: background }]}>
          <DetailScreen id={open.id} t0={open.t0} variant={open.variant} settled={settled} onBack={onBack} heroHidden={fly !== null} heroRef={hero} text={text} />
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
            opacity: p.interpolate({ inputRange: [0, P100, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [fly.from.x + fly.from.w / 2 - (fly.to.x + fly.to.w / 2), 0] }) },
              { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [fly.from.y + fly.from.h / 2 - (fly.to.y + fly.to.h / 2), 0] }) },
              { scale: p.interpolate({ inputRange: [0, 1], outputRange: [fly.from.w / fly.to.w, 1] }) },
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
