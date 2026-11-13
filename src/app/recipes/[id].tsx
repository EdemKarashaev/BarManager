import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar, Badges, Message, palette, ui } from '@/components/recipe-ui';
import { fetchRecipe, recipeError } from '@/lib/recipes';
import { formatAmount, type Recipe, type RecipeStep } from '@/lib/recipe-model';
import { useAuth } from '@/providers/auth';
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff, session } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    // Refetch on explicit retry and account changes; never retain another session's data.
    void revision;
    if (!session?.user.id) return;
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    setRecipe(null); setSteps([]); setLoading(true); setError('');
    if (typeof id !== 'string' || !/^\d+$/.test(id)) { clearTimeout(timer); setLoading(false); return; }
    fetchRecipe(id, controller.signal).then(result => {
      if (!alive) return;
      const allowed = result.recipe && (!result.recipe.admin_only || staff?.isAdmin);
      if (allowed) { setRecipe(result.recipe); setSteps(result.steps); setVariantId(result.recipe?.variants[0]?.id ?? null); }
    }).catch(err => { if (alive) setError(recipeError(err)); })
      .finally(() => { clearTimeout(timer); if (alive) setLoading(false); });
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [id, revision, session?.user.id, staff?.isAdmin]));
  const variant = recipe?.variants.find(v => v.id === variantId);
  return <SafeAreaView style={ui.screen}>
    <BackBar title="КАРТОЧКА ТТК" />
    {loading ? <View style={s.loading}><ActivityIndicator color={palette.text} /></View> : error ? <Message text={error} action="Повторить" onPress={() => setRevision(v => v+1)} /> : !recipe ? <Message text="Рецептура не найдена или недоступна для вашей роли." action="К каталогу" onPress={() => router.replace('/recipes')} /> : <ScrollView contentContainerStyle={s.content}>
      <Text style={ui.eyebrow}>{recipe.category?.name || 'ТТК'}</Text>
      <Text style={ui.title}>{recipe.name || 'Без названия'}</Text>
      <Badges recipe={recipe} />
      {!!recipe.description && <Text style={ui.body}>{recipe.description}</Text>}
      <Text style={s.heading}>Выход и порция</Text>
      <View style={s.variants}>{recipe.variants.map(v => <Pressable key={v.id} accessibilityRole="button" accessibilityState={{ selected: v.id === variantId }} onPress={() => setVariantId(v.id)} style={[s.variant, v.id === variantId && s.selected]}><Text style={ui.text}>{v.name}</Text></Pressable>)}</View>
      {variant && <Text style={ui.body}>Выход: {formatAmount(variant.yield_amount, variant.yield_unit)}</Text>}
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
      <View style={s.panel}><Text style={s.heading}>Приготовление</Text>
        {!!recipe.preparation_method && <Text style={ui.body}>{recipe.preparation_method}</Text>}
        {steps.map((step, i) => <View key={step.id} style={s.step}><Text style={s.number}>{i+1}</Text><Text style={[ui.body, { flex: 1, color: palette.text }]}>{step.instruction || 'Описание не заполнено'}</Text></View>)}
        {!steps.length && !recipe.preparation_method && <Text style={ui.body}>Технология пока не заполнена.</Text>}
      </View>
      {!!recipe.serving_notes && <View style={s.panel}><Text style={s.heading}>Подача</Text><Text style={ui.body}>{recipe.serving_notes}</Text></View>}
    </ScrollView>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  content: { padding: 22, paddingBottom: 40, gap: 15 }, loading: { padding: 40 },
  heading: { color: palette.text, fontWeight: '600', fontSize: 20, marginTop: 5 },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, variant: { borderWidth: 1, borderColor: palette.border, padding: 14, borderRadius: 10 }, selected: { borderColor: '#C45C63', backgroundColor: '#413035' },
  panel: { backgroundColor: palette.panel, padding: 18, borderRadius: 14, gap: 14 },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: palette.border },
  amount: { color: palette.text, fontSize: 14, textAlign: 'right', maxWidth: '38%', lineHeight: 21, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, lineHeight: 18, color: palette.muted }, link: { color: '#EE9EA4', fontSize: 13, paddingVertical: 7 },
  step: { flexDirection: 'row', gap: 12 }, number: { color: '#EE9EA4', fontSize: 17, fontWeight: '700', paddingTop: 2 },
});
