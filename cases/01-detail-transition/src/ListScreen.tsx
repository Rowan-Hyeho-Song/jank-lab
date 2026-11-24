import { useRef, type ComponentRef } from 'react'
import { Animated, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRODUCTS, won, type Product } from './data'
import { C, EDGE, GAP, RATIO, type Rect } from './layout'
import { PHOTOS } from './photos'
import { useLast } from './timing'
import { VARIANTS, setVariant, useVariant } from './variant'

type Props = {
  /** a card was tapped: its id, the tap time and where its picture is on screen */
  onOpen: (id: number, t0: number, from: Rect) => void
  /** the card whose picture is flying to (or back from) the detail screen: its own picture hides meanwhile */
  hiddenId: number | null
  /** that picture's opacity, driven with the transition (App.tsx): it stays under the flying copy for the first 100 ms */
  hiddenOpacity: Animated.AnimatedInterpolation<number> | number
}

function Card({ p, index, width, opacity, onOpen }: { p: Product; index: number; width: number; opacity: Props['hiddenOpacity']; onOpen: Props['onOpen'] }) {
  const photo = useRef<ComponentRef<typeof View>>(null)
  const press = () => {
    const t0 = performance.now()
    photo.current?.measureInWindow((x, y, w, h) => onOpen(p.id, t0, { x, y, w, h }))
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`card-${index}`} accessibilityHint={`${p.brand} ${p.title} 상세 열기`} onPress={press} style={{ width }}>
      <View ref={photo} collapsable={false} style={[s.photoBox, { width, height: width * RATIO }]}>
        <Animated.Image source={PHOTOS[p.photo]} style={[s.photo, { opacity }]} resizeMode="cover" />
      </View>
      <Text style={s.brand} numberOfLines={1}>
        {p.brand}
      </Text>
      <Text style={s.title} numberOfLines={2}>
        {p.title}
      </Text>
      <Text style={s.price}>{won(p.price)}</Text>
    </Pressable>
  )
}

export function ListScreen({ onOpen, hiddenId, hiddenOpacity }: Props) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const variant = useVariant()
  const last = useLast()
  const note = VARIANTS.find((v) => v.id === variant)!.note
  const cardW = (width - EDGE * 2 - GAP) / 2
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Text style={s.h1}>상세 화면 전환</Text>
        <Text style={s.sub}>jank-lab 사례 1 · 전환이 UI 스레드에 막히는 문제</Text>
        <View style={s.chips} accessibilityRole="radiogroup">
          {VARIANTS.map((v) => {
            const on = variant === v.id
            return (
              <Pressable key={v.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setVariant(v.id)} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipText, on && s.chipTextOn]}>{v.label}</Text>
              </Pressable>
            )
          })}
        </View>
        <Text style={s.note}>{note}</Text>
        <Text style={s.readout}>
          {last.transition === undefined && last.content === undefined
            ? '상품을 누르면 전환과 리뷰 표시까지 걸린 시간을 여기 적습니다.'
            : `전환 끝 ${last.transition?.toFixed(0) ?? '-'} ms · 리뷰 표시 ${last.content?.toFixed(0) ?? '-'} ms`}
        </Text>
      </View>
      <FlatList
        data={PRODUCTS}
        numColumns={2}
        extraData={hiddenId}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ paddingHorizontal: EDGE, paddingTop: EDGE, paddingBottom: insets.bottom + EDGE, gap: 24 }}
        columnWrapperStyle={{ gap: GAP }}
        renderItem={({ item, index }) => <Card p={item} index={index} width={cardW} opacity={hiddenId === item.id ? hiddenOpacity : 1} onOpen={onOpen} />}
      />
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  head: { paddingHorizontal: EDGE, paddingTop: 12, paddingBottom: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  h1: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: C.text },
  sub: { marginTop: -6, fontSize: 13, lineHeight: 18, color: C.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 14, lineHeight: 18, color: C.text },
  chipTextOn: { color: C.bg, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, color: C.text2 },
  readout: { fontSize: 13, lineHeight: 18, color: C.text, fontVariant: ['tabular-nums'] },
  photoBox: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#e9e6df' },
  photo: { width: '100%', height: '100%' },
  brand: { marginTop: 10, fontSize: 12, lineHeight: 16, fontWeight: '600', color: C.muted },
  title: { marginTop: 2, fontSize: 15, lineHeight: 20, color: C.text },
  price: { marginTop: 2, fontSize: 15, lineHeight: 20, fontWeight: '700', color: C.text },
})
