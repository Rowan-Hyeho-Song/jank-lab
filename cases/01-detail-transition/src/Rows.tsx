import { memo } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import type { Review } from './data'
import { PHOTOS } from './photos'

// One review row, in two drawings with the same views and the same layout:
//  - ReviewRow: the real look, a card with a 1 px line, round corners and two pictures (no shadow: an Android
//    elevation shadow does not fade with its parent's opacity, so it stayed on screen while the detail faded out)
//  - FlatRow (variant C): no line, no round corners, plain boxes where the pictures were, wrapped in memo.
//    Less to draw (GPU) and nothing to re-render; the number of native views is the same.

export function ReviewRow({ r }: { r: Review }) {
  return (
    <View style={s.card}>
      <View style={s.top}>
        <Image source={PHOTOS[r.photo]} style={s.avatar} />
        <View style={s.who}>
          <Text style={s.name}>{r.name}</Text>
          <Text style={s.meta}>{r.date}</Text>
        </View>
        <View style={s.stars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[s.star, i < r.rating && s.starOn]} />
          ))}
        </View>
      </View>
      <Text style={s.text}>{r.text}</Text>
      <View style={s.bottom}>
        <Image source={PHOTOS[(r.photo + 2) % 6]} style={s.shot} />
        <View style={s.tags}>
          {r.tags.map((t, i) => (
            <View key={i} style={s.tag}>
              <Text style={s.tagText}>{t}</Text>
            </View>
          ))}
          <Text style={s.meta}>도움돼요 {r.helpful}</Text>
        </View>
      </View>
    </View>
  )
}

export const FlatRow = memo(function FlatRow({ r }: { r: Review }) {
  return (
    <View style={[s.card, f.card]}>
      <View style={s.top}>
        <View style={[s.avatar, f.box]} />
        <View style={s.who}>
          <Text style={s.name}>{r.name}</Text>
          <Text style={s.meta}>{r.date}</Text>
        </View>
        <View style={s.stars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[s.star, f.flat, i < r.rating && s.starOn]} />
          ))}
        </View>
      </View>
      <Text style={s.text}>{r.text}</Text>
      <View style={s.bottom}>
        <View style={[s.shot, f.box]} />
        <View style={s.tags}>
          {r.tags.map((t, i) => (
            <View key={i} style={[s.tag, f.flat]}>
              <Text style={s.tagText}>{t}</Text>
            </View>
          ))}
          <Text style={s.meta}>도움돼요 {r.helpful}</Text>
        </View>
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2dfd8', backgroundColor: '#ffffff' },
  top: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  who: { flex: 1, marginLeft: 10 },
  name: { fontSize: 14, fontWeight: '600', color: '#1d1d1f' },
  meta: { fontSize: 12, color: '#6b6962' },
  stars: { flexDirection: 'row' },
  star: { width: 10, height: 10, marginLeft: 2, borderRadius: 5, backgroundColor: '#e2dfd8' },
  starOn: { backgroundColor: '#c98a12' },
  text: { marginTop: 10, fontSize: 14, lineHeight: 20, color: '#2b2a27' },
  bottom: { flexDirection: 'row', marginTop: 10, alignItems: 'center' },
  shot: { width: 56, height: 56, borderRadius: 10 },
  tags: { flex: 1, marginLeft: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#f1efe9' },
  tagText: { fontSize: 11, color: '#4a4842' },
})

const f = StyleSheet.create({
  card: { borderRadius: 0, borderWidth: 0 },
  box: { borderRadius: 0, backgroundColor: '#dcd8cf' },
  flat: { borderRadius: 0 },
})
