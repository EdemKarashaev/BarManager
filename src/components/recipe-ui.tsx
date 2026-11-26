import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { statusColors, statusLabels, type Recipe } from '@/lib/recipe-model';
const makeThemepalette = (bmMode: ThemeMode) => ({ bg: (bmMode === 'light' ? '#FFFFFF' : '#151518'), panel: (bmMode === 'light' ? '#F5F5F5' : '#222226'), border: (bmMode === 'light' ? '#DDDDDD' : '#38383F'), text: (bmMode === 'light' ? '#111111' : '#F5F3F0'), muted: (bmMode === 'light' ? '#666666' : '#ADAAB4'), red: (bmMode === 'light' ? '#B00020' : '#D64048') });
const themeCachepalette = { dark: makeThemepalette('dark'), light: makeThemepalette('light') };
export const getThemepalette = (mode: ThemeMode) => themeCachepalette[mode];

export function BackBar({ title }: { title: string }) {
  const { mode: bmMode } = useAppTheme();
  const ui = getThemeui(bmMode);

  return <View style={ui.bar}><Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={ui.back}><Text style={ui.text}>‹ Назад</Text></Pressable><Text style={ui.eyebrow}>{title}</Text></View>;
}
export function Badges({ recipe }: { recipe: Recipe }) {
  const { mode: bmMode } = useAppTheme();
  const palette = getThemepalette(bmMode);
  const ui = getThemeui(bmMode);

  return <View style={ui.badges}>
    {recipe.status !== 'active' && <Text style={[ui.badge, { color: (bmMode === 'light' ? (recipe.status === 'coming_soon' ? '#187747' : '#B00020') : statusColors[recipe.status]) || palette.muted }]}>{statusLabels[recipe.status] || recipe.status}</Text>}
    {recipe.admin_only && <Text style={[ui.badge, { color: (bmMode === 'light' ? '#6545A5' : '#C4B5FD') }]}>Скрыто · только ADMIN</Text>}
    {recipe.recipe_type === 'prep' && <Text style={ui.badge}>Заготовка</Text>}
  </View>;
}
export function Message({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) {
  const { mode: bmMode } = useAppTheme();
  const ui = getThemeui(bmMode);

  return <View style={ui.message}><Text style={ui.body}>{text}</Text>{!!action && <Pressable accessibilityRole="button" style={ui.button} onPress={onPress}><Text style={ui.text}>{action}</Text></Pressable>}</View>;
}
const makeThemeui = (bmMode: ThemeMode) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: getThemepalette(bmMode).bg },
  bar: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back: { paddingVertical: 12, paddingRight: 16 }, text: { color: getThemepalette(bmMode).text, fontSize: 15, fontWeight: '600' },
  eyebrow: { color: getThemepalette(bmMode).muted, fontSize: 11, letterSpacing: 2 },
  title: { color: getThemepalette(bmMode).text, fontSize: 30, fontWeight: '700', lineHeight: 37 },
  body: { color: getThemepalette(bmMode).muted, fontSize: 15, lineHeight: 23 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { fontSize: 12, color: getThemepalette(bmMode).muted, backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#2D2D33'), paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, overflow: 'hidden' },
  message: { padding: 24, gap: 18 },
  button: { paddingVertical: 14, paddingHorizontal: 20, backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#36363E'), borderRadius: 12, alignSelf: 'flex-start' },
});
const themeCacheui = { dark: makeThemeui('dark'), light: makeThemeui('light') };
export const getThemeui = (mode: ThemeMode) => themeCacheui[mode];

