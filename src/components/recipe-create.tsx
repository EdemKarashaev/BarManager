import { RecipeSectionPicker } from '@/components/recipe-section-picker';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme';
import { useAuth } from '@/providers/auth';
import { blockUpdates } from '@/lib/update-guard';
import type {
  Recipe,
  RecipeStatus,
} from '@/lib/recipe-model';

type Item = {
  id?: number;
  name: string;
  ingredient_id?: number;
  quantity: string;
  unit: string;
};

type VolumeVariant = {
  id?: number;
  name: string;
  amount: string;
  unit: string;
  items: Item[];
};

const emptyItem = (): Item => ({
  name: '',
  quantity: '',
  unit: 'мл',
});

export function RecipeCreate({
  recipes,
  onCreated,
  disabled,
  editRecipe,
}: {
  recipes: Recipe[];
  onCreated: () => void;
  disabled?: boolean;
  editRecipe?: Recipe;
}) {
  const { staff, offline } = useAuth();
  const { colors } = useAppTheme();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [type, setType] = useState('drink');
  const [status, setStatus] =
    useState<RecipeStatus>('coming_soon');
  const [archived, setArchived] = useState(true);
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [method, setMethod] = useState('');
  const [serving, setServing] = useState('');
  const [amount, setAmount] = useState('');
  const [yieldUnit, setYieldUnit] = useState('мл');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const lock = useRef(false);

  const [multi, setMulti] = useState(false);
  const [variants, setVariants] = useState<VolumeVariant[]>([]);
  const [variantIndex, setVariantIndex] = useState(0);

  function collectVariants(): VolumeVariant[] {
    if (!variants.length) {
      return [{
        name: 'Основной',
        amount,
        unit: yieldUnit,
        items,
      }];
    }

    return variants.map((v, index) =>
      index === variantIndex
        ? { ...v, items, amount, unit: yieldUnit }
        : v
    );
  }

  function switchVariant(index: number) {
    const next = collectVariants();
    const selected = next[index];

    if (!selected) return;

    setVariants(next);
    setVariantIndex(index);
    setItems(selected.items);
    setAmount(selected.amount);
    setYieldUnit(selected.unit);
  }

  function addVolume() {
    const next = collectVariants();

    if (next.length >= 20) return;

    const created: VolumeVariant = {
      name: 'Объём ' + (next.length + 1),
      amount: '',
      unit: 'мл',
      items: [emptyItem()],
    };

    setMulti(true);
    setVariants([...next, created]);
    setVariantIndex(next.length);
    setItems(created.items);
    setAmount('');
    setYieldUnit('мл');
  }

  const ingredients = [...new Map(
    recipes.flatMap(r =>
      r.variants.flatMap(v =>
        v.items.flatMap(i =>
          i.ingredient?.name
            ? [[i.ingredient.id, i.ingredient] as const]
            : []
        )
      )
    )
  ).values()];

  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    padding: 9,
    fontSize: 13,
    minHeight: 40,
  };

  function reset() {
    setName('');
    setSection('');
    setType('drink');
    setStatus('coming_soon');
    setArchived(true);
    setItems([emptyItem()]);
    setMethod('');
    setServing('');
    setAmount('');
    setYieldUnit('мл');
    setError('');
    setConfirmClose(false);
    setMulti(false);
    setVariants([]);
    setVariantIndex(0);
  }

  function startEditing() {
    reset();

    if (editRecipe) {
      const loaded: VolumeVariant[] =
        editRecipe.variants.map(v => ({
          id: v.id,
          name: v.name ?? 'Основной',
          amount: v.yield_amount == null
            ? '' : String(v.yield_amount),
          unit: v.yield_unit ?? '',
          items: v.items.map(i => ({
            id: i.id,
            ingredient_id: i.ingredient?.id,
            name: i.ingredient?.name ?? '',
            quantity: i.quantity == null
              ? '' : String(i.quantity),
            unit: i.unit ?? '',
          })),
        }));

      setVariants(loaded);
      setMulti(loaded.length > 1);
      setVariantIndex(0);

      if (loaded.length) {
        setItems(loaded[0].items);
        setAmount(loaded[0].amount);
        setYieldUnit(loaded[0].unit);
      }

      setName(editRecipe.name ?? '');
      setSection(editRecipe.source_sheet ?? '');
      setType(editRecipe.recipe_type);
      setStatus(editRecipe.status);
      setArchived(
        editRecipe.admin_only || !!editRecipe.archived_at
      );
      setMethod(editRecipe.preparation_method ?? '');
      setServing(editRecipe.serving_notes ?? '');
    }

    setOpen(true);
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems(old => old.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    ));
  }

  function close() {
    if (lock.current) return;

    const dirty =
      !!name.trim() ||
      !!section ||
      !!method.trim() ||
      !!serving.trim() ||
      !!amount.trim() ||
      items.some(i =>
        !!i.name.trim() || !!i.quantity.trim()
      );

    if (!dirty) {
      setOpen(false);
      reset();
      return;
    }

    setConfirmClose(true);
  }

  async function save() {
    if (lock.current || offline || !staff?.isAdmin) return;

    setError('');

    if (!name.trim() || !section) {
      setError('Укажите название и раздел.');
      return;
    }

    if (editRecipe && editRecipe.revision == null) {
      setError('Обновите данные ТТК.');
      return;
    }

    const currentVariants = collectVariants();

    const validNumber = (value: string) =>
      /^\d+([.,]\d+)?$/.test(value.trim()) &&
      Number.isFinite(Number(value.replace(',', '.'))) &&
      Number(value.replace(',', '.')) >= 0;

    const numeric = (value: string) =>
      value.trim() === ''
        ? null
        : Number(value.replace(',', '.'));

    if (
      currentVariants.length > 20 ||
      currentVariants.some(v =>
        !v.name.trim() ||
        !v.items.length ||
        v.items.length > 200 ||
        (v.amount.trim() && !validNumber(v.amount)) ||
        (multi && (
          !v.amount.trim() ||
          !validNumber(v.amount) ||
          Number(v.amount.replace(',', '.')) <= 0 ||
          !v.unit.trim()
        )) ||
        v.items.some(i =>
          (!i.ingredient_id && !i.name.trim()) ||
          (i.quantity.trim()
            ? !validNumber(i.quantity)
            : !editRecipe || !i.id) ||
          (!i.unit.trim() && (!editRecipe || !i.id))
        )
      )
    ) {
      setError('Проверьте состав и выход всех объёмов.');
      return;
    }

    if (multi && currentVariants.length < 2) {
      setError('Добавьте второй объём.');
      return;
    }

    const volumeKeys = currentVariants.map(v =>
      String(numeric(v.amount)) + ':' +
      v.unit.trim().toLowerCase()
    );

    if (multi && new Set(volumeKeys).size !== volumeKeys.length) {
      setError('Объёмы не должны повторяться.');
      return;
    }

    let ambiguous = false;

    const payload = currentVariants.map(v => ({
      id: v.id ?? null,
      name: v.name.trim(),
      yield_amount: numeric(v.amount),
      yield_unit: v.unit.trim(),
      items: v.items.map(i => {
        const matches = ingredients.filter(x =>
          x.name?.trim().toLowerCase() ===
          i.name.trim().toLowerCase()
        );

        if (!i.ingredient_id && matches.length > 1) {
          ambiguous = true;
        }

        return {
          id: i.id ?? null,
          name: i.name.trim(),
          ingredient_id: i.ingredient_id ??
            (matches.length === 1 ? matches[0].id : null),
          quantity: numeric(i.quantity),
          unit: i.unit.trim(),
        };
      }),
    }));

    if (ambiguous) {
      setError('Выберите нужный ингредиент из подсказок.');
      return;
    }

    lock.current = true;
    setBusy(true);
    const unblock = blockUpdates();

    try {
      const data = {
        name: name.trim(),
        source_sheet: section,
        recipe_type: type,
        status,
        admin_only: archived,
        preparation_method: method,
        serving_notes: serving,
        variants: payload,
      };

      const { error: rpcError } = editRecipe
        ? await supabase.rpc('bm_recipe_update_full', {
            p_recipe_id: editRecipe.id,
            p_expected_revision: editRecipe.revision,
            p_data: data,
          })
        : await supabase.rpc('bm_recipe_create', {
            p_data: data,
          });

      if (rpcError) throw rpcError;

      setOpen(false);
      reset();
      onCreated();
    } catch (e) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String(e.message)
          : 'Не удалось создать ТТК.'
      );
    } finally {
      unblock();
      lock.current = false;
      setBusy(false);
    }
  }

  if (!staff?.isAdmin) return null;

  return <>
    <Pressable
      disabled={disabled || offline}
      onPress={startEditing}
      style={{
        backgroundColor: colors.primary,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        opacity: disabled || offline ? 0.4 : 1,
      }}
    >
      <Text style={{
        color: colors.onPrimary,
        fontSize: 13,
        fontWeight: '700',
      }}>{editRecipe ? 'Редактировать ТТК' : '+ Добавить ТТК'}</Text>
    </Pressable>

    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#00000088',
        padding: 12,
      }}>
        <View style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90%',
          borderRadius: 12,
          backgroundColor: colors.background,
          padding: 12,
          gap: 8,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Text style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: '700',
            }}>{editRecipe ? 'Редактирование ТТК' : 'Новая ТТК'}</Text>

            <Pressable onPress={close} disabled={busy}>
              <Text style={{
                color: colors.muted,
                fontSize: 24,
              }}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8 }}
          >
            <TextInput
              editable={!busy}
              value={name}
              onChangeText={setName}
              placeholder="Название ТТК"
              placeholderTextColor={colors.muted}
              style={inputStyle}
            />

            {open && <RecipeSectionPicker
              value={section}
              onChange={setSection}
              disabled={busy}
            />}

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                ['drink', 'Напиток'],
                ['prep', 'Заготовка'],
              ].map(([value, label]) => (
                <Pressable
                  key={value}
                  disabled={busy}
                  onPress={() => setType(value)}
                  style={{
                    flex: 1,
                    padding: 9,
                    borderRadius: 7,
                    backgroundColor: type === value
                      ? colors.primary : colors.surface,
                  }}
                >
                  <Text style={{
                    textAlign: 'center',
                    color: type === value
                      ? colors.onPrimary : colors.text,
                  }}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 5 }}>
              {([
                ['coming_soon', 'На ввод'],
                ['active', 'В меню'],
                ['phasing_out', 'На вывод'],
              ] as [RecipeStatus, string][]).map(([v, label]) => (
                <Pressable
                  key={v}
                  disabled={busy}
                  onPress={() => setStatus(v)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 6,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: status === v
                      ? colors.accent : colors.border,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    textAlign: 'center',
                    color: v === 'coming_soon'
                      ? colors.success
                      : v === 'phasing_out'
                        ? colors.error : colors.text,
                  }}>{status === v ? '✓ ' : ''}{label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              disabled={busy || (multi && variants.length > 1)}
              onPress={() => setMulti(v => !v)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 10,
                borderRadius: 7,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.text }}>
                Несколько объёмов
              </Text>
              <Text style={{
                color: multi ? colors.success : colors.muted,
                fontWeight: '700',
              }}>
                {multi ? 'ВКЛ' : 'ВЫКЛ'}
              </Text>
            </Pressable>

            {multi && <>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 5,
              }}>
                {collectVariants().map((v, index) => (
                  <Pressable
                    key={v.id ?? 'volume-' + index}
                    disabled={busy}
                    onPress={() => switchVariant(index)}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      backgroundColor: index === variantIndex
                        ? colors.primary : colors.surface,
                    }}
                  >
                    <Text style={{
                      color: index === variantIndex
                        ? colors.onPrimary : colors.text,
                      fontSize: 12,
                    }}>
                      {v.amount
                        ? v.amount + ' ' + v.unit
                        : v.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                disabled={busy || variants.length >= 20}
                onPress={addVolume}
                style={{ padding: 6 }}
              >
                <Text style={{ color: colors.accent }}>
                  + Добавить объём
                </Text>
              </Pressable>
            </>}

            <>
            <Text style={{
              color: colors.text,
              fontWeight: '700',
              marginTop: 6,
            }}>Ингредиенты</Text>

            {items.map((item, index) => {
              const suggestions = item.name.trim().length >= 2 &&
                !item.ingredient_id
                ? ingredients.filter(i =>
                    i.name?.toLowerCase().includes(
                      item.name.trim().toLowerCase()
                    )
                  ).slice(0, 5)
                : [];

              return <View key={index} style={{ gap: 4 }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <TextInput
                    editable={!busy}
                    value={item.name}
                    onChangeText={value =>
                      updateItem(index, {
                        name: value,
                        ingredient_id: undefined,
                      })
                    }
                    placeholder="Ингредиент"
                    placeholderTextColor={colors.muted}
                    style={[inputStyle, { flex: 1 }]}
                  />

                  <TextInput
                    editable={!busy}
                    value={item.quantity}
                    onChangeText={value =>
                      updateItem(index, { quantity: value })
                    }
                    keyboardType="decimal-pad"
                    placeholder="Кол-во"
                    placeholderTextColor={colors.muted}
                    style={[inputStyle, { width: 65 }]}
                  />

                  <TextInput
                    editable={!busy}
                    value={item.unit}
                    onChangeText={value =>
                      updateItem(index, { unit: value })
                    }
                    style={[inputStyle, { width: 48 }]}
                  />

                  <Pressable
                    disabled={busy || items.length === 1}
                    onPress={() =>
                      setItems(old =>
                        old.filter((_, i) => i !== index)
                      )
                    }
                    style={{ padding: 6 }}
                  >
                    <Text style={{
                      color: colors.error,
                      fontSize: 20,
                    }}>×</Text>
                  </Pressable>
                </View>

                {suggestions.map(i => (
                  <Pressable
                    key={i.id}
                    disabled={busy}
                    onPress={() => updateItem(index, {
                      name: i.name || '',
                      ingredient_id: i.id,
                    })}
                    style={{
                      padding: 8,
                      borderRadius: 5,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Text style={{
                      color: colors.text,
                      fontSize: 12,
                    }}>
                      {i.name}
                      {i.prep_recipe_id ? ' · заготовка' : ''}
                      {' · №' + i.id}
                    </Text>
                  </Pressable>
                ))}
              </View>;
            })}

            <Pressable
              disabled={busy}
              onPress={() =>
                setItems(old => [...old, emptyItem()])
              }
              style={{ padding: 8 }}
            >
              <Text style={{ color: colors.accent }}>
                + Добавить ингредиент
              </Text>
            </Pressable>

            <Text style={{
              color: colors.text,
              fontWeight: '700',
              marginTop: 6,
            }}>
              {type === 'prep'
                ? 'Стандартный выход готового изделия'
                : 'Выход и порция'}
            </Text>

            {type === 'prep' && (
              <Text style={{
                color: colors.muted,
                fontSize: 12,
                lineHeight: 18,
              }}>
                Укажите фактический выход по данной рецептуре.
                Бармен сможет рассчитать любое необходимое количество.
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput
                editable={!busy}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Количество"
                placeholderTextColor={colors.muted}
                style={[inputStyle, { flex: 1 }]}
              />
              <TextInput
                editable={!busy}
                value={yieldUnit}
                onChangeText={setYieldUnit}
                style={[inputStyle, { width: 65 }]}
              />
            </View>

            </>

            <TextInput
              editable={!busy}
              value={method}
              onChangeText={setMethod}
              multiline
              placeholder="Технология приготовления"
              placeholderTextColor={colors.muted}
              style={[inputStyle, { minHeight: 70 }]}
            />

            <TextInput
              editable={!busy}
              value={serving}
              onChangeText={setServing}
              multiline
              placeholder="Подача и оформление"
              placeholderTextColor={colors.muted}
              style={[inputStyle, { minHeight: 55 }]}
            />

            <Text style={{ color: colors.muted }}>
              Куда сохранить
            </Text>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[false, true].map(value => (
                <Pressable
                  key={String(value)}
                  disabled={busy}
                  onPress={() => setArchived(value)}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 7,
                    backgroundColor: archived === value
                      ? colors.primary : colors.surface,
                  }}
                >
                  <Text style={{
                    textAlign: 'center',
                    color: archived === value
                      ? colors.onPrimary : colors.text,
                  }}>{value ? 'В архив' : 'В меню'}</Text>
                </Pressable>
              ))}
            </View>

            {!!error && <Text style={{
              color: colors.error,
              fontSize: 12,
            }}>{error}</Text>}


          </ScrollView>

          {confirmClose && <View style={{
            backgroundColor: colors.surface,
            padding: 10,
            borderRadius: 8,
            gap: 8,
          }}>
            <Text style={{ color: colors.text }}>
              Закрыть без сохранения?
            </Text>
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              <Pressable onPress={() => {
                setOpen(false);
                reset();
              }}>
                <Text style={{ color: colors.error }}>
                  Закрыть
                </Text>
              </Pressable>
              <Pressable onPress={() =>
                setConfirmClose(false)
              }>
                <Text style={{ color: colors.accent }}>
                  Продолжить
                </Text>
              </Pressable>
            </View>
          </View>}

          <Pressable
            disabled={busy || confirmClose}
            onPress={save}
            style={{
              backgroundColor: colors.primary,
              padding: 11,
              borderRadius: 8,
              alignItems: 'center',
              opacity: busy || confirmClose ? 0.5 : 1,
            }}
          >
            <Text style={{
              color: colors.onPrimary,
              fontWeight: '700',
            }}>
              {busy ? 'Сохраняем…' : editRecipe ? 'Сохранить изменения' : archived
                ? 'Сохранить в архив'
                : 'Опубликовать ТТК'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </>;
}
