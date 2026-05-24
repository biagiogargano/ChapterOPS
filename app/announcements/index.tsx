/**
 * app/announcements/index.tsx — chapter announcements board prototype.
 * PROTOTYPE ONLY. A simple feed of chapter-wide announcements with a mock
 * "post" composer (officers). Feeds naturally into the meeting agenda later.
 * Local state, nothing saved. Dev-only; not in phase-2 / the alpha.
 */

import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

interface Post { author: string; role: string; text: string; when: string }

const SEED: Post[] = [
  { author: 'Peter', role: 'Consul',      text: 'Chapter meeting moved to 8pm Sunday — be on time.', when: '2h ago' },
  { author: 'Alex',  role: 'Social Chair', text: 'Formal tickets are live. Grab yours by Friday.',     when: 'Yesterday' },
  { author: 'Sam',   role: 'Recruitment',  text: 'Rush week prep starts Monday — sign up for slots.',   when: '2d ago' },
];

export default function AnnouncementsScreen() {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>(SEED);
  const [draft, setDraft] = useState('');

  useEffect(() => { navigation.setOptions({ title: 'Announcements' }); }, [navigation]);

  function post() {
    const t = draft.trim();
    if (!t) return;
    setPosts(prev => [{ author: 'You', role: 'Officer', text: t, when: 'Just now' }, ...prev]);
    setDraft('');
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={s.protoBadge}><Text style={s.protoText}>PROTOTYPE · sample feed, nothing saved</Text></View>

      <Text style={s.heading}>Announcements</Text>
      <Text style={s.sub}>Chapter-wide notices. Officers post; everyone sees.</Text>

      <View style={s.composer}>
        <TextInput style={s.input} placeholder="Share something with the chapter…" placeholderTextColor="#475569" value={draft} onChangeText={setDraft} multiline />
        <Pressable style={[s.postBtn, !draft.trim() && s.postBtnOff]} onPress={post} disabled={!draft.trim()}>
          <Text style={[s.postText, !draft.trim() && s.postTextOff]}>Post</Text>
        </Pressable>
      </View>

      {posts.map((p, i) => (
        <View key={i} style={s.card}>
          <View style={s.cardHead}>
            <View style={s.avatar}><Text style={s.avatarText}>{p.author[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.author}>{p.author} <Text style={s.role}>· {p.role}</Text></Text>
              <Text style={s.when}>{p.when}</Text>
            </View>
          </View>
          <Text style={s.text}>{p.text}</Text>
        </View>
      ))}

      <Text style={s.footNote}>These can also flow into the auto-drafted meeting agenda.</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f172a' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },

  protoBadge: { alignSelf: 'flex-start', backgroundColor: '#422006', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 16, borderWidth: 1, borderColor: '#92400e' },
  protoText:  { color: '#fbbf24', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },

  heading: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  sub:     { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 18 },

  composer: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 18, gap: 10 },
  input:    { color: '#f1f5f9', fontSize: 15, minHeight: 44, textAlignVertical: 'top' },
  postBtn:  { alignSelf: 'flex-end', backgroundColor: '#1e3a5f', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 18, borderWidth: 1, borderColor: '#3b82f6' },
  postBtnOff:{ backgroundColor: '#0f172a', borderColor: '#334155' },
  postText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
  postTextOff:{ color: '#475569' },

  card:     { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  author:   { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
  role:     { fontSize: 12, color: '#64748b', fontWeight: '500' },
  when:     { fontSize: 11, color: '#475569', marginTop: 1 },
  text:     { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },

  footNote: { fontSize: 12, color: '#475569', marginTop: 16, lineHeight: 18 },
});
