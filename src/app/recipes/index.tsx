import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar, Badges, Message, palette, ui } from '@/components/recipe-ui';
import { recipeError } from '@/lib/recipes';
import { loadLocalRecipes, syncRecipes } from '@/lib/recipe-sync';
import { matchesRecipe, visibleRecipes, type Recipe, type RecipeStatus, statusColors } from '@/lib/recipe-model';
import { useAuth } from '@/providers/auth';
type Filter = 'all' | RecipeStatus | 'hidden';
const filters: { key: Filter; label: string }[] = [{ key: 'all', label: 'Все' }, { key: 'coming_soon', label: 'На ввод' }, { key: 'phasing_out', label: 'На вывод' }, { key: 'hidden', label: 'Скрытые' }];
export default function RecipesScreen() {
  const { staff, session, offline } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [hiddenPreference, setHiddenPreference] = useState<{
    userId: string;
    enabled: boolean;
  } | null>(null);

  const isAdmin = staff?.isAdmin === true;
  const userId = session?.user.id;
  const showHidden =
    isAdmin &&
    !!userId &&
    hiddenPreference?.userId === userId &&
    hiddenPreference.enabled;

  useEffect(() => {
    let alive = true;

    if (!isAdmin || !userId) {
      setHiddenPreference(null);
      return;
    }

    AsyncStorage.getItem('bm:recipes:show-hidden:' + userId)
      .then(value => {
        if (alive) {
          setHiddenPreference({
            userId,
            enabled: value === 'true',
          });
        }
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [isAdmin, userId]);

  const toggleHidden = () => {
    if (!isAdmin || !userId) return;
    const next = !showHidden;

    setHiddenPreference({ userId, enabled: next });
    setCategory('');

    if (!next) setFilter('all');

    void AsyncStorage.setItem(
      'bm:recipes:show-hidden:' + userId,
      String(next),
    ).catch(() => {});
  };
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  useFocusEffect(useCallback(() => {
    void revision;

    const userId = session?.user.id;
    const roleId = staff?.roleId;

    setRecipes([]);
    setError('');
    setSyncStatus('');
    setLoading(true);

    if (!userId || roleId == null) {
      setLoading(false);
      return;
    }

    let alive = true;
    let hasCache = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    setSyncing(true);

    (async () => {
      const cached = await loadLocalRecipes(userId, roleId);

      if (!alive) return;

      if (cached) {
        hasCache = true;
        setRecipes(cached.recipes);
        setLoading(false);
        setSyncStatus('Проверяем обновления…');
      }

      if (offline) {
        setSyncStatus('Автономный режим');
        if (!cached) setError('Сохранённых ТТК пока нет.');
        return;
      }

      if (
        cached &&
        staff?.isAdmin !== true &&
        revision === 0 &&
        Date.now() - cached.savedAt < 15 * 60 * 1000
      ) {
        setSyncStatus('ТТК сохранены на устройстве');
        return;
      }

      const result = await syncRecipes(
        userId,
        roleId,
        staff?.isAdmin === true,
        controller.signal,
      );

      if (!alive) return;

      setRecipes(result.recipes);
      setSyncStatus(
        result.persisted
          ? 'ТТК сохранены на устройстве'
          : 'Локальное сохранение недоступно'
      );
    })().catch(err => {
      if (!alive) return;

      if (hasCache) {
        setSyncStatus('Показаны сохранённые ТТК');
      } else {
        setError(recipeError(err));
      }
    }).finally(() => {
      clearTimeout(timer);

      if (alive) {
        setLoading(false);
        setSyncing(false);
      }
    });

    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [revision, session?.user.id, staff?.roleId, staff?.isAdmin, offline]));
  const availableRecipes = useMemo(
    () => visibleRecipes(recipes, showHidden),
    [recipes, showHidden],
  );

  const categories = useMemo(
    () => [...new Set(
      availableRecipes
        .map(r => r.category?.name)
        .filter((name): name is string => !!name)
    )].sort((a, b) => a.localeCompare(b, 'ru')),
    [availableRecipes],
  );

  const activeCategory =
    categories.includes(category) ? category : '';

  const activeFilter =
    filter === 'hidden' && !showHidden ? 'all' : filter;

  const shown = useMemo(() => availableRecipes.filter(r =>
    matchesRecipe(r, query) &&
    (!activeCategory || r.category?.name === activeCategory) &&
    (activeFilter === 'all' ||
      (activeFilter === 'hidden'
        ? r.admin_only
        : r.status === activeFilter))
  ), [availableRecipes, query, activeCategory, activeFilter]);

  const reset = () => { setQuery(''); setCategory(''); setFilter('all'); };
  return <SafeAreaView style={ui.screen}>
    <BackBar title="СПРАВОЧНИК" />
    <View style={s.header}><Text style={s.title}>Технологические карты</Text></View>
    <View style={s.search}>
      <TextInput accessibilityLabel="Поиск ТТК по названию и ингредиентам" placeholder="Название или ингредиент" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} autoCorrect={false} style={s.input} returnKeyType="search" />
      {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Очистить поиск" onPress={() => setQuery('')} style={s.clear}><Text style={ui.text}>×</Text></Pressable>}
    </View>
    {isAdmin && <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: showHidden }}
      accessibilityLabel="Показывать скрытые позиции"
      onPress={toggleHidden}
      style={s.hiddenToggle}
    >
      <View style={[
        s.checkbox,
        showHidden && s.checkboxChecked
      ]}>
        {showHidden && <Text style={s.checkmark}>✓</Text>}
      </View>
      <Text style={s.hiddenLabel}>
        Показывать скрытые позиции
      </Text>
    </Pressable>}
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {filters.filter(f => f.key !== 'hidden' || showHidden).map(f => <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: activeFilter === f.key }} onPress={() => setFilter(f.key)} style={[s.chip, activeFilter === f.key && s.selected]}><Text style={s.chipText}>{f.label}</Text></Pressable>)}
    </ScrollView></View>
    {categories.length > 1 && <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {['', ...categories].map(c => <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: c === activeCategory }} onPress={() => setCategory(c)} style={[s.chip, c === activeCategory && s.selected]}><Text style={s.chipText}>{c || 'Все разделы'}</Text></Pressable>)}
    </ScrollView></View>}
    {loading ? <View style={s.loading}><ActivityIndicator color={palette.text} /><Text style={ui.body}>Загружаем ТТК…</Text></View> : error ? <Message text={error} action="Повторить" onPress={() => setRevision(v => v+1)} /> : <>
      <View style={s.syncRow}>
        <Text style={s.syncText}>Найдено: {shown.length}</Text>
        <Pressable onPress={() => setRevision(v => v + 1)}
          disabled={syncing}>
          <Text style={s.syncText}>
            {syncing ? 'Синхронизация…' : syncStatus || 'Обновить ↻'}
          </Text>
        </Pressable>
      </View>
      <FlatList data={shown} keyExtractor={r => String(r.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}
        refreshing={syncing && !loading} onRefresh={() => setRevision(v => v+1)}
        ListEmptyComponent={<Message text={recipes.length ? 'По вашему запросу ничего не найдено.' : 'Доступных ТТК пока нет. Проверьте импорт данных и роль сотрудника.'} action={recipes.length ? 'Сбросить фильтры' : 'Обновить'} onPress={recipes.length ? reset : () => setRevision(v => v+1)} />}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Открыть ТТК: ${item.name || 'Без названия'}`} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: String(item.id) } })}
          style={({ pressed }) => [s.card, { borderLeftColor: item.status === 'active' ? palette.border : statusColors[item.status] || palette.border }, pressed && { opacity: 0.75 }]}>
          <Text style={s.category}>{item.category?.name || 'Без категории'}</Text>
          <Text style={s.name}>{item.name || 'Без названия'}</Text>

          <Badges recipe={item} />
        </Pressable>} />
    </>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  hiddenToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#C7A56B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#C7A56B',
  },
  checkmark: {
    color: '#181818',
    fontSize: 16,
    fontWeight: '700',
  },
  hiddenLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '500',
  },
  syncRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  syncText: {
    color: palette.muted,
    fontSize: 11,
  },
  title: { color: palette.text, fontSize: 25, fontWeight: '700' },
  header: { paddingHorizontal: 16, paddingBottom: 10, gap: 4 },
  search: { marginHorizontal: 14, flexDirection: 'row', backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, borderRadius: 12, alignItems: 'center' },
  input: { flex: 1, padding: 10, color: palette.text, fontSize: 14, minHeight: 44 }, clear: { padding: 10 },
  chips: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2, gap: 6 }, chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border }, selected: { backgroundColor: '#413035', borderColor: '#C45C63' },
  count: { marginHorizontal: 16, marginTop: 10, marginBottom: 6, color: palette.muted, fontSize: 11, letterSpacing: 1.5 },
  list: { paddingHorizontal: 14, paddingBottom: 20, gap: 6 },
  card: { backgroundColor: palette.panel, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 3, borderWidth: 1, borderColor: palette.border, borderLeftWidth: 4 },
  chipText: { color: palette.text, fontSize: 13, fontWeight: '500' },
  category: { color: palette.muted, fontSize: 11 }, name: { color: palette.text, fontSize: 17, fontWeight: '600', lineHeight: 22 },
  loading: { padding: 30, gap: 14, alignItems: 'center' },
});
