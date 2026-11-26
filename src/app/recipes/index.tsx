import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { RecipeCreate } from '@/components/recipe-create';
import { RecipeAdminMenu } from '@/components/recipe-admin-menu';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar, Badges, Message, getThemepalette, getThemeui } from '@/components/recipe-ui';
import { recipeError } from '@/lib/recipes';
import { loadLocalRecipes, syncRecipes } from '@/lib/recipe-sync';
import { matchesRecipe, visibleRecipes, type Recipe, type RecipeStatus, statusColors } from '@/lib/recipe-model';
import { useAuth } from '@/providers/auth';
type Filter = 'all' | RecipeStatus;
const filters: { key: Filter; label: string }[] = [{ key: 'all', label: 'Все' }, { key: 'coming_soon', label: 'На ввод' }, { key: 'phasing_out', label: 'На вывод' }];
export default function RecipesScreen() {
  const { mode: bmMode } = useAppTheme();
  const s = getThemes(bmMode);
  const palette = getThemepalette(bmMode);
  const ui = getThemeui(bmMode);

  const { staff, session, offline } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const isAdmin = staff?.isAdmin === true;
  const [archiveMode, setArchiveMode] = useState(false);
  const inArchive = isAdmin && archiveMode;

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
    () => visibleRecipes(recipes, isAdmin).filter(r =>
      inArchive
        ? r.admin_only || !!r.archived_at
        : !r.admin_only && !r.archived_at
    ),
    [recipes, isAdmin, inArchive],
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

  const activeFilter = inArchive ? 'all' : filter;

  const shown = useMemo(() => availableRecipes.filter(r =>
    matchesRecipe(r, query) &&
    (!activeCategory || r.category?.name === activeCategory) &&
    (activeFilter === 'all' || r.status === activeFilter)
  ), [availableRecipes, query, activeCategory, activeFilter]);

  const reset = () => { setQuery(''); setCategory(''); setFilter('all'); };
  return <SafeAreaView style={ui.screen}>
    <BackBar title="СПРАВОЧНИК" />
    <View style={s.header}><Text style={s.title}>Технологические карты</Text></View>
    <View style={s.search}>
      <TextInput accessibilityLabel="Поиск ТТК по названию и ингредиентам" placeholder="Название или ингредиент" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} autoCorrect={false} style={s.input} returnKeyType="search" />
      {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Очистить поиск" onPress={() => setQuery('')} style={s.clear}><Text style={ui.text}>×</Text></Pressable>}
    </View>
    {isAdmin && <View style={s.archiveTabs}>
      {[false, true].map(value => (
        <Pressable
          key={String(value)}
          accessibilityRole="button"
          accessibilityState={{ selected: inArchive === value }}
          onPress={() => {
            setArchiveMode(value);
            setCategory('');
            setFilter('all');
          }}
          style={[
            s.archiveTab,
            inArchive === value && s.selected,
          ]}
        >
          <Text style={s.chipText}>
            {value ? 'Архив' : 'Меню'}
          </Text>
        </Pressable>
      ))}
    </View>}

    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {filters.map(f => <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: activeFilter === f.key }} onPress={() => setFilter(f.key)} style={[s.chip, activeFilter === f.key && s.selected]}><Text style={s.chipText}>{f.label}</Text></Pressable>)}
    </ScrollView></View>
    {categories.length > 1 && <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {['', ...categories].map(c => <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: c === activeCategory }} onPress={() => setCategory(c)} style={[s.chip, c === activeCategory && s.selected]}><Text style={s.chipText}>{c || 'Все разделы'}</Text></Pressable>)}
    </ScrollView></View>}
    {isAdmin && <View style={{
      marginHorizontal: 14,
      marginTop: 8,
      marginBottom: 4,
    }}>
      <RecipeCreate
        recipes={recipes}
        disabled={loading || syncing || !!error}
        onCreated={() => setRevision(v => v + 1)}
      />
    </View>}
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
        renderItem={({ item }) => <View style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}><Pressable accessibilityRole="button" accessibilityLabel={`Открыть ТТК: ${item.name || 'Без названия'}`} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: String(item.id) } })}
          style={({ pressed }) => [s.card, { flex: 1, borderLeftColor: item.status === 'active' ? palette.border : statusColors[item.status] || palette.border }, pressed && { opacity: 0.75 }]}>
          <Text style={s.category}>{item.category?.name || 'Без категории'}</Text>
          <Text style={s.name}>{item.name || 'Без названия'}</Text>

          <Badges recipe={item} />
          {!!item.archived_at &&
            <Text style={{ color: palette.muted, fontSize: 12 }}>
              В архиве
            </Text>}
        </Pressable>
        {isAdmin && <RecipeAdminMenu
          recipe={item}
          disabled={syncing || loading}
          onChanged={() => setRevision(v => v + 1)}
        />}
        </View>} />
    </>}
  </SafeAreaView>;
}
const makeThemes = (bmMode: ThemeMode) => StyleSheet.create({
  archiveTabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginTop: 8,
    gap: 6,
  },
  archiveTab: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: getThemepalette(bmMode).border,
    backgroundColor: getThemepalette(bmMode).panel,
  },
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
    borderColor: (bmMode === 'light' ? '#DDDDDD' : '#C7A56B'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: (bmMode === 'light' ? '#CC0014' : '#C7A56B'),
  },
  checkmark: {
    color: '#181818',
    fontSize: 16,
    fontWeight: '700',
  },
  hiddenLabel: {
    color: getThemepalette(bmMode).text,
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
    color: getThemepalette(bmMode).muted,
    fontSize: 11,
  },
  title: { color: getThemepalette(bmMode).text, fontSize: 25, fontWeight: '700' },
  header: { paddingHorizontal: 16, paddingBottom: 10, gap: 4 },
  search: { marginHorizontal: 14, flexDirection: 'row', backgroundColor: getThemepalette(bmMode).panel, borderWidth: 1, borderColor: getThemepalette(bmMode).border, borderRadius: 12, alignItems: 'center' },
  input: { flex: 1, padding: 10, color: getThemepalette(bmMode).text, fontSize: 14, minHeight: 44 }, clear: { padding: 10 },
  chips: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2, gap: 6 }, chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: getThemepalette(bmMode).panel, borderWidth: 1, borderColor: getThemepalette(bmMode).border }, selected: { backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#413035'), borderColor: (bmMode === 'light' ? '#D99BA1' : '#C45C63') },
  count: { marginHorizontal: 16, marginTop: 10, marginBottom: 6, color: getThemepalette(bmMode).muted, fontSize: 11, letterSpacing: 1.5 },
  list: { paddingHorizontal: 14, paddingBottom: 20, gap: 6 },
  card: { backgroundColor: getThemepalette(bmMode).panel, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 3, borderWidth: 1, borderColor: getThemepalette(bmMode).border, borderLeftWidth: 4 },
  chipText: { color: getThemepalette(bmMode).text, fontSize: 13, fontWeight: '500' },
  category: { color: getThemepalette(bmMode).muted, fontSize: 11 }, name: { color: getThemepalette(bmMode).text, fontSize: 17, fontWeight: '600', lineHeight: 22 },
  loading: { padding: 30, gap: 14, alignItems: 'center' },
});
const themeCaches = { dark: makeThemes('dark'), light: makeThemes('light') };
const getThemes = (mode: ThemeMode) => themeCaches[mode];

