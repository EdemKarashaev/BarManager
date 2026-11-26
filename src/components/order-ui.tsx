import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const makeThemeos = (bmMode: ThemeMode) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: (bmMode === 'light' ? '#FFFFFF' : '#151518') },
  content: { padding: 18, gap: 12, paddingBottom: 36 },
  text: { color: (bmMode === 'light' ? '#111111' : '#F4F1ED'), fontSize: 15 },
  muted: { color: (bmMode === 'light' ? '#666666' : '#B3B1BA'), fontSize: 13 },
  title: { color: (bmMode === 'light' ? '#111111' : '#F4F1ED'), fontSize: 25, fontWeight: '700' },
  heading: { color: (bmMode === 'light' ? '#111111' : '#F4F1ED'), fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  card: { backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#222226'), padding: 16, borderRadius: 14, gap: 10, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: (bmMode === 'light' ? '#DDDDDD' : '#59545B'), borderRadius: 10, padding: 12, color: (bmMode === 'light' ? '#111111' : '#FFF'), minHeight: 46, backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#1C1B20') },
  button: { backgroundColor: (bmMode === 'light' ? '#CC0014' : '#713F4A'), padding: 13, borderRadius: 10, minHeight: 46, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.4 },
  chip: { backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#29272E'), borderWidth: 1, borderColor: (bmMode === 'light' ? '#DDDDDD' : '#59545B'), borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, minHeight: 30, justifyContent: 'center' },
  selected: { borderColor: (bmMode === 'light' ? '#D99BA1' : '#EE9EA4'), backgroundColor: (bmMode === 'light' ? '#FCE7E9' : '#4A303B') },
  error: { color: (bmMode === 'light' ? '#B00020' : '#FFA6A6'), fontSize: 14 },
  success: { color: (bmMode === 'light' ? '#187747' : '#9CE1AD'), fontSize: 14 },
  footer: { padding: 16, gap: 8, borderTopWidth: 1, borderColor: (bmMode === 'light' ? '#DDDDDD' : '#47414B'), backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#1B191F') },
  qty: { width: 95, textAlign: 'center' },
  cell: { width: 92, padding: 10, color: (bmMode === 'light' ? '#111111' : '#eee'), borderBottomWidth: 1, borderBottomColor: (bmMode === 'light' ? '#DDDDDD' : '#3D3841') },
  nameCell: { width: 220 },
  line: { height: 1, backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#444') },
});
const themeCacheos = { dark: makeThemeos('dark'), light: makeThemeos('light') };
export const getThemeos = (mode: ThemeMode) => themeCacheos[mode];


export function OButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { mode: bmMode } = useAppTheme();
  const os = getThemeos(bmMode);

  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[os.button, disabled && os.disabled]}><Text style={[os.text, { color: bmMode === 'light' ? '#FFFFFF' : '#F4F1ED' }]}>{title}</Text></Pressable>;
}

export function Choice({ value, options, onChange, disabled = false }: { value: string; options: { id: string; name: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  const { mode: bmMode } = useAppTheme();
  const os = getThemeos(bmMode);

  return <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 5, paddingVertical: 1 }}>
    {options.map(o => <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: value === o.id, disabled }} disabled={disabled} onPress={() => onChange(o.id)} style={[os.chip, value === o.id && os.selected]}><Text numberOfLines={1} style={{ color: (bmMode === 'light' ? '#111111' : '#F4F1ED'), fontSize: 11 }}>{o.name}</Text></Pressable>)}
  </ScrollView>;
}

// Поля minPrice/maxPrice оставлены в типе для совместимости с order-rules.
// В интерфейсе они отсутствуют и всегда пустые.
export type Filters = { supplierId: string; category: string; insufficientOnly: boolean; minPrice: string; maxPrice: string; sort: 'price_asc' | 'price_desc' | undefined; query: string };
export const emptyFilters: Filters = { supplierId: '', category: '', insufficientOnly: false, minPrice: '', maxPrice: '', sort: undefined, query: '' };

export function OrderFilters({ filters: f, onChange: set, suppliers, categories, showShortage = true }: { filters: Filters; onChange: (v: Filters) => void; suppliers: { id: string; name: string }[]; categories: string[]; showShortage?: boolean }) {
  const { mode: bmMode } = useAppTheme();
  const os = getThemeos(bmMode);

  const sortOptions: { id: Filters['sort']; label: string }[] = [
    { id: undefined, label: 'По списку' }, { id: 'price_asc', label: 'Цена ↑' }, { id: 'price_desc', label: 'Цена ↓' },
  ];
  const sortIndex = sortOptions.findIndex(o => o.id === f.sort);
  const nextSort = sortOptions[((sortIndex < 0 ? 0 : sortIndex) + 1) % sortOptions.length];
  return <View style={{ gap: 3 }}>
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      <TextInput accessibilityLabel="Поиск товара" placeholder="Поиск товара" placeholderTextColor={(bmMode === 'light' ? '#666666' : "#aaa")} value={f.query} onChangeText={query => set({ ...f, query })} style={[os.input, { flex: 1, height: 35, minHeight: 35, paddingVertical: 3, paddingHorizontal: 9, fontSize: 12 }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Изменить сортировку" onPress={() => set({ ...f, sort: nextSort.id })} style={[os.chip, { height: 35, paddingHorizontal: 8 }]}><Text style={{ color: (bmMode === 'light' ? '#111111' : '#F4F1ED'), fontSize: 11 }}>{sortOptions[sortIndex < 0 ? 0 : sortIndex].label} ⇅</Text></Pressable>
      {showShortage && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: f.insufficientOnly }} onPress={() => set({ ...f, insufficientOnly: !f.insufficientOnly })} style={[os.chip, { height: 35, paddingHorizontal: 8 }, f.insufficientOnly && os.selected]}><Text style={{ color: (bmMode === 'light' ? '#111111' : '#F4F1ED'), fontSize: 11 }}>Недобор</Text></Pressable>}
    </View>
    <Choice value={f.supplierId} options={[{ id: '', name: 'Все поставщики' }, ...suppliers]} onChange={supplierId => set({ ...f, supplierId })} />
    <Choice value={f.category} options={[{ id: '', name: 'Все разделы' }, ...categories.map(name => ({ id: name, name }))]} onChange={category => set({ ...f, category })} />
  </View>;
}
