import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar, Badges, Message, palette, ui } from '@/components/recipe-ui';
import { fetchRecipes, recipeError } from '@/lib/recipes';
import { matchesRecipe, visibleRecipes, type Recipe, type RecipeStatus, statusColors } from '@/lib/recipe-model';
import { useAuth } from '@/providers/auth';
type Filter = 'all' | RecipeStatus | 'hidden';
const filters: { key: Filter; label: string }[] = [{ key: 'all', label: 'Все' }, { key: 'coming_soon', label: 'На ввод' }, { key: 'phasing_out', label: 'На вывод' }, { key: 'hidden', label: 'Скрытые' }];
export default function RecipesScreen() {
  const { staff, session } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    // Refetch on explicit retry and account changes; never retain another session's data.
    void revision;
    if (!session?.user.id) return;
    const controller = new AbortController();
    let alive = true;
    const timer = setTimeout(() => controller.abort(), 25000);
    setLoading(true); setError(''); setRecipes([]);
    fetchRecipes(controller.signal).then(rows => {
      if (alive) setRecipes(visibleRecipes(rows, staff?.isAdmin === true));
    }).catch(err => { if (alive) setError(recipeError(err)); })
      .finally(() => { clearTimeout(timer); if (alive) setLoading(false); });
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [revision, session?.user.id, staff?.isAdmin]));
  const categories = useMemo(() => [...new Set(recipes.map(r => r.category?.name).filter((name): name is string => !!name))].sort((a,b) => a.localeCompare(b, 'ru')), [recipes]);
  const shown = useMemo(() => recipes.filter(r =>
    matchesRecipe(r, query) && (!category || r.category?.name === category) &&
    (filter === 'all' || (filter === 'hidden' ? r.admin_only : r.status === filter))
  ), [recipes, query, category, filter]);
  const reset = () => { setQuery(''); setCategory(''); setFilter('all'); };
  return <SafeAreaView style={ui.screen}>
    <BackBar title="СПРАВОЧНИК" />
    <View style={s.header}><Text style={ui.title}>Технологические{ '\n' }карты</Text><Text style={ui.body}>Состав, пропорции и подача</Text></View>
    <View style={s.search}>
      <TextInput accessibilityLabel="Поиск ТТК по названию и ингредиентам" placeholder="Название или ингредиент" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} autoCorrect={false} style={s.input} returnKeyType="search" />
      {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Очистить поиск" onPress={() => setQuery('')} style={s.clear}><Text style={ui.text}>×</Text></Pressable>}
    </View>
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {filters.filter(f => f.key !== 'hidden' || staff?.isAdmin).map(f => <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: filter === f.key }} onPress={() => setFilter(f.key)} style={[s.chip, filter === f.key && s.selected]}><Text style={ui.text}>{f.label}</Text></Pressable>)}
    </ScrollView></View>
    {categories.length > 1 && <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {['', ...categories].map(c => <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: c === category }} onPress={() => setCategory(c)} style={[s.chip, c === category && s.selected]}><Text style={ui.text}>{c || 'Все разделы'}</Text></Pressable>)}
    </ScrollView></View>}
    {loading ? <View style={s.loading}><ActivityIndicator color={palette.text} /><Text style={ui.body}>Загружаем ТТК…</Text></View> : error ? <Message text={error} action="Повторить" onPress={() => setRevision(v => v+1)} /> : <>
      <Text style={s.count}>НАЙДЕНО: {shown.length}</Text>
      <FlatList data={shown} keyExtractor={r => String(r.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}
        refreshing={false} onRefresh={() => setRevision(v => v+1)}
        ListEmptyComponent={<Message text={recipes.length ? 'По вашему запросу ничего не найдено.' : 'Доступных ТТК пока нет. Проверьте импорт данных и роль сотрудника.'} action={recipes.length ? 'Сбросить фильтры' : 'Обновить'} onPress={recipes.length ? reset : () => setRevision(v => v+1)} />}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Открыть ТТК: ${item.name || 'Без названия'}`} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: String(item.id) } })}
          style={({ pressed }) => [s.card, { borderLeftColor: item.status === 'active' ? palette.border : statusColors[item.status] || palette.border }, pressed && { opacity: 0.75 }]}>
          <Text style={s.category}>{item.category?.name || 'Без категории'}</Text>
          <Text style={s.name}>{item.name || 'Без названия'}</Text>
          <Text style={ui.body}>{item.variants.map(v => v.name).join(' · ') || 'Выход не указан'}</Text>
          <Badges recipe={item} />
        </Pressable>} />
    </>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingBottom: 20, gap: 7 },
  search: { marginHorizontal: 20, flexDirection: 'row', backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, borderRadius: 12, alignItems: 'center' },
  input: { flex: 1, padding: 15, color: palette.text, fontSize: 16, minHeight: 52 }, clear: { padding: 16 },
  chips: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 8 }, chip: { padding: 12, borderRadius: 10, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border }, selected: { backgroundColor: '#413035', borderColor: '#C45C63' },
  count: { marginHorizontal: 22, marginTop: 20, marginBottom: 12, color: palette.muted, fontSize: 11, letterSpacing: 1.5 },
  list: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  card: { backgroundColor: palette.panel, borderRadius: 14, padding: 18, gap: 9, borderWidth: 1, borderColor: palette.border, borderLeftWidth: 4 },
  category: { color: palette.muted, fontSize: 12 }, name: { color: palette.text, fontSize: 21, fontWeight: '600', lineHeight: 28 },
  loading: { padding: 30, gap: 14, alignItems: 'center' },
});
