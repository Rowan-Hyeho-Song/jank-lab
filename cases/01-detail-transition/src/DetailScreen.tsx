import { memo, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRODUCTS, REVIEW_ROWS, reviews, won, type Review } from './data'
import { BAR, C, EDGE, METER, RATIO } from './layout'
import { PHOTOS } from './photos'
import { FlatRow, ReviewRow } from './Rows'
import { report } from './timing'
import type { Variant } from './variant'

// The detail screen. Its head (the hero picture, name, price) is light; its review list is the heavy part: 150 rows
// with pictures and round corners, all mounted at once in a plain ScrollView. The reviews "arrive" on the next tick, as
// cached data would, so in A they mount while the transition is still running.
//
//   A  mounts the reviews as soon as they arrive (during the transition)
//   B  shows a light placeholder during the transition and mounts the reviews once it has ended (`settled`)
//   C  as A, with the rows drawn flat (FlatRow: no line, round corners or pictures; memo)
//   D  as A, with the transition turned off (App.tsx)
//   E  as B, then mounts the rows CHUNK per frame instead of all in one frame

type Props = {
  id: number
  t0: number
  variant: Variant
  settled: boolean
  /** the hero hides while the flying copy of the picture (App.tsx) stands in for it, on the native driver */
  heroOpacity: Animated.AnimatedInterpolation<number>
  /** how far the screen is scrolled, so closing can start the copy where the hero is */
  onScrollY: (y: number) => void
  /** the text under the hero rises and fades in with the transition (App.tsx, DESIGN.md 4.2) */
  text: { opacity: Animated.AnimatedInterpolation<number> | Animated.Value; translateY: Animated.AnimatedInterpolation<number> | number }
}

/** E: rows mounted per frame */
const CHUNK = 5

export function DetailScreen({ id, t0, variant, settled, heroOpacity, onScrollY, text }: Props) {
  const p = PRODUCTS[id]
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [data, setData] = useState<Review[] | null>(null)
  const laidOut = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setData(reviews(id)), 0)
    return () => clearTimeout(t)
  }, [id])

  const waits = variant === 'b' || variant === 'e'
  const heavy = data !== null && (!waits || settled)
  const Row = variant === 'c' ? FlatRow : ReviewRow

  const [shown, setShown] = useState(variant === 'e' ? 0 : REVIEW_ROWS)
  useEffect(() => {
    if (!heavy || shown >= REVIEW_ROWS) return
    const f = requestAnimationFrame(() => setShown((n) => Math.min(REVIEW_ROWS, n + CHUNK)))
    return () => cancelAnimationFrame(f)
  }, [heavy, shown])

  const onLayout = useCallback(() => {
    if (laidOut.current || shown < REVIEW_ROWS) return
    laidOut.current = true
    report(variant, 'content', performance.now() - t0)
  }, [shown, variant, t0])

  return (
    <View style={s.screen}>
      {/* the bar with the way back and the meter are fixed above (Top.tsx); the hero starts right under them */}
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + BAR + METER, paddingBottom: insets.bottom + EDGE }}
        scrollEventThrottle={32}
        onScroll={(e) => onScrollY(e.nativeEvent.contentOffset.y)}
      >
        <View style={{ width, height: width * RATIO, backgroundColor: '#e9e6df' }}>
          <Animated.Image source={PHOTOS[p.photo]} style={[s.fill, { opacity: heroOpacity }]} resizeMode="cover" />
        </View>
        <Animated.View style={{ opacity: text.opacity, transform: [{ translateY: text.translateY }] }}>
        <View style={s.info}>
          <Text style={s.brand}>{p.brand}</Text>
          <Text style={s.title}>{p.title}</Text>
          <Text style={s.price}>{won(p.price)}</Text>
          <Text style={s.meta}>무료배송 · 오늘 출발</Text>
        </View>
        <Text style={s.section}>리뷰 {REVIEW_ROWS}개</Text>
        {heavy ? (
          <Reviews data={data!} shown={shown} Row={Row} onLayout={onLayout} />
        ) : (
          <View accessibilityLabel="reviews-placeholder">
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.skeleton} />
            ))}
          </View>
        )}
        </Animated.View>
      </ScrollView>
    </View>
  )
}

/** the review list, apart: the hero and the text above it change during closing, and that must not render 150 rows again */
const Reviews = memo(function Reviews({ data, shown, Row, onLayout }: { data: Review[]; shown: number; Row: ComponentType<{ r: Review }>; onLayout: () => void }) {
  return (
    <View onLayout={onLayout} accessibilityLabel="reviews">
      {data.slice(0, shown).map((r) => (
        <Row key={r.id} r={r} />
      ))}
    </View>
  )
})

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  fill: { width: '100%', height: '100%' },
  info: { paddingHorizontal: EDGE, paddingTop: 20, paddingBottom: 8 },
  brand: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: C.muted },
  title: { marginTop: 4, fontSize: 22, lineHeight: 28, color: C.text },
  price: { marginTop: 8, fontSize: 20, lineHeight: 26, fontWeight: '700', color: C.text },
  meta: { marginTop: 6, fontSize: 13, lineHeight: 18, color: C.muted },
  section: { paddingHorizontal: EDGE, marginTop: 24, marginBottom: 12, fontSize: 17, lineHeight: 22, fontWeight: '700', color: C.text },
  skeleton: { height: 150, marginHorizontal: EDGE, marginBottom: 12, borderRadius: 12, backgroundColor: '#ebe8e1' },
})
