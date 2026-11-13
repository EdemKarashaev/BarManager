import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { statusColors, statusLabels, type Recipe } from '@/lib/recipe-model';
export const palette = { bg: '#151518', panel: '#222226', border: '#38383F', text: '#F5F3F0', muted: '#ADAAB4', red: '#D64048' };
export function BackBar({ title }: { title: string }) {
  return <View style={ui.bar}><Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={ui.back}><Text style={ui.text}>‹ Назад</Text></Pressable><Text style={ui.eyebrow}>{title}</Text></View>;
}
export function Badges({ recipe }: { recipe: Recipe }) {
  return <View style={ui.badges}>
    {recipe.status !== 'active' && <Text style={[ui.badge, { color: statusColors[recipe.status] || palette.muted }]}>{statusLabels[recipe.status] || recipe.status}</Text>}
    {recipe.admin_only && <Text style={[ui.badge, { color: '#C4B5FD' }]}>Скрыто · только ADMIN</Text>}
    {recipe.recipe_type === 'prep' && <Text style={ui.badge}>Заготовка</Text>}
  </View>;
}
export function Message({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) {
  return <View style={ui.message}><Text style={ui.body}>{text}</Text>{!!action && <Pressable accessibilityRole="button" style={ui.button} onPress={onPress}><Text style={ui.text}>{action}</Text></Pressable>}</View>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  bar: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back: { paddingVertical: 12, paddingRight: 16 }, text: { color: palette.text, fontSize: 15, fontWeight: '600' },
  eyebrow: { color: palette.muted, fontSize: 11, letterSpacing: 2 },
  title: { color: palette.text, fontSize: 30, fontWeight: '700', lineHeight: 37 },
  body: { color: palette.muted, fontSize: 15, lineHeight: 23 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { fontSize: 12, color: palette.muted, backgroundColor: '#2D2D33', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, overflow: 'hidden' },
  message: { padding: 24, gap: 18 },
  button: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: '#36363E', borderRadius: 12, alignSelf: 'flex-start' },
});
