import { useAppTheme, type ThemeMode } from '@/providers/theme';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar, Badges, Message, getThemepalette, getThemeui } from '@/components/recipe-ui';
import { fetchRecipe, recipeError } from '@/lib/recipes';
import { loadLocalRecipes } from '@/lib/recipe-sync';
import { formatAmount, type Recipe, type RecipeStep } from '@/lib/recipe-model';
import { useAuth } from '@/providers/auth';
import { RecipeCalculator } from '@/components/recipe-calculator';
import { canCalculate } from '@/lib/recipe-calculator';
export default function RecipeScreen() {
  const { mode: bmMode } = useAppTheme();
  const s = getThemes(bmMode);
  const palette = getThemepalette(bmMode);
  const ui = getThemeui(bmMode);

  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff, session, offline: authOffline } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [offline, setOffline] = useState(false);
  useFocusEffect(useCallback(() => {
    void revision;

    const userId = session?.user.id;
    const roleId = staff?.roleId;

    setRecipe(null);
    setSteps([]);
    setVariantId(null);
    setError('');
    setOffline(false);
    setLoading(true);

    if (
      !userId ||
      roleId == null ||
      typeof id !== 'string' ||
      !/^[0-9]+$/.test(id)
    ) {
      setLoading(false);
      return;
    }

    let alive = true;
    let hasCache = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    (async () => {
      const cached = await loadLocalRecipes(userId, roleId);

      if (!alive) return;

      const local = cached?.recipes.find(
        item => String(item.id) === id
      );

      if (local) {
        hasCache = true;
        setRecipe(local);
        setSteps(cached?.steps[id] || []);
        setVariantId(local.variants[0]?.id ?? null);
        setLoading(false);
        setOffline(true);
      }

      if (authOffline) {
        if (!local) setError('Эта ТТК недоступна без интернета.');
        return;
      }

      const result = await fetchRecipe(id, controller.signal);

      if (!alive) return;

      const allowed = result.recipe &&
        (result.recipe.admin_only === false || staff?.isAdmin === true);

      if (allowed && result.recipe) {
        setRecipe(result.recipe);
        setSteps(result.steps);

        const variants = result.recipe.variants;

        setVariantId(previous =>
          variants.some(v => v.id === previous)
            ? previous
            : variants[0]?.id ?? null
        );

        setOffline(false);
      } else {
        setRecipe(null);
        setSteps([]);
        setOffline(false);
      }
    })().catch(err => {
      if (!alive) return;

      if (hasCache) {
        setOffline(true);
      } else {
        setError(recipeError(err));
      }
    }).finally(() => {
      clearTimeout(timer);
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [id, revision, session?.user.id, staff?.roleId, staff?.isAdmin, authOffline]));
  const variant = recipe?.variants.find(v => v.id === variantId);
  return <SafeAreaView style={ui.screen}>
    <BackBar title="КАРТОЧКА ТТК" />
    {loading ? <View style={s.loading}><ActivityIndicator color={palette.text} /></View> : error ? <Message text={error} action="Повторить" onPress={() => setRevision(v => v+1)} /> : !recipe ? <Message text="Рецептура не найдена или недоступна для вашей роли." action="К каталогу" onPress={() => router.replace('/recipes')} /> : <ScrollView contentContainerStyle={s.content}>
      <Text style={ui.eyebrow}>{recipe.category?.name || 'ТТК'}</Text>
      <Text style={ui.title}>{recipe.name || 'Без названия'}</Text>
      <Badges recipe={recipe} />
      {offline && <Text style={{
        color: (bmMode === 'light' ? '#B00020' : '#C7A56B'),
        fontSize: 12,
      }}>Сохранённая версия ТТК</Text>}
      {!!recipe.description && <Text style={ui.body}>{recipe.description}</Text>}
      <Text style={s.heading}>Выход и порция</Text>
      <View style={s.variants}>{recipe.variants.map(v => <Pressable key={v.id} accessibilityRole="button" accessibilityState={{ selected: v.id === variantId }} onPress={() => setVariantId(v.id)} style={[s.variant, v.id === variantId && s.selected]}><Text style={ui.text}>{v.name}</Text></Pressable>)}</View>
      {variant && <Text style={ui.body}>Выход: {formatAmount(variant.yield_amount, variant.yield_unit)}</Text>}
      {recipe.recipe_type === 'prep' && variant &&
        canCalculate(variant) ? (
          <RecipeCalculator
            key={`${recipe.id}:${variant.id}:${variant.yield_amount}:${variant.yield_unit}`}
            variant={variant}
            recipeName={recipe.name ?? ''}
          />
        ) : (
      <View style={s.panel}>
        <Text style={s.heading}>Состав</Text>
        {!variant?.items.length && <Text style={ui.body}>Состав пока не заполнен.</Text>}
        {variant?.items.map(item => <View key={item.id} style={s.item}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={ui.text}>{item.ingredient?.name || 'Ингредиент недоступен'}</Text>
            {!!item.notes && <Text style={s.note}>{item.notes}</Text>}
            {!!item.ingredient?.prep_recipe_id && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: String(item.ingredient!.prep_recipe_id) } })}><Text style={s.link}>Открыть ТТК заготовки ›</Text></Pressable>}
          </View>
          <Text style={s.amount}>{formatAmount(item.quantity, item.unit)}</Text>
        </View>)}
      </View>
      )}
      <View style={s.panel}><Text style={s.heading}>Приготовление</Text>
        {!!recipe.preparation_method && <Text style={ui.body}>{recipe.preparation_method}</Text>}
        {steps.map((step, i) => <View key={step.id} style={s.step}><Text style={s.number}>{i+1}</Text><Text style={[ui.body, { flex: 1, color: palette.text }]}>{step.instruction || 'Описание не заполнено'}</Text></View>)}
        {!steps.length && !recipe.preparation_method && <Text style={ui.body}>Технология пока не заполнена.</Text>}
      </View>
      {!!recipe.serving_notes && <View style={s.panel}><Text style={s.heading}>Подача</Text><Text style={ui.body}>{recipe.serving_notes}</Text></View>}
    </ScrollView>}
  </SafeAreaView>;
}
const makeThemes = (bmMode: ThemeMode) => StyleSheet.create({
  content: { padding: 22, paddingBottom: 40, gap: 15 }, loading: { padding: 40 },
  heading: { color: getThemepalette(bmMode).text, fontWeight: '600', fontSize: 20, marginTop: 5 },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, variant: { borderWidth: 1, borderColor: getThemepalette(bmMode).border, padding: 14, borderRadius: 10 }, selected: { borderColor: (bmMode === 'light' ? '#D99BA1' : '#C45C63'), backgroundColor: (bmMode === 'light' ? '#F5F5F5' : '#413035') },
  panel: { backgroundColor: getThemepalette(bmMode).panel, padding: 18, borderRadius: 14, gap: 14 },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: getThemepalette(bmMode).border },
  amount: { color: getThemepalette(bmMode).text, fontSize: 14, textAlign: 'right', maxWidth: '38%', lineHeight: 21, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, lineHeight: 18, color: getThemepalette(bmMode).muted }, link: { color: (bmMode === 'light' ? '#B00020' : '#EE9EA4'), fontSize: 13, paddingVertical: 7 },
  step: { flexDirection: 'row', gap: 12 }, number: { color: (bmMode === 'light' ? '#B00020' : '#EE9EA4'), fontSize: 17, fontWeight: '700', paddingTop: 2 },
});
const themeCaches = { dark: makeThemes('dark'), light: makeThemes('light') };
const getThemes = (mode: ThemeMode) => themeCaches[mode];

