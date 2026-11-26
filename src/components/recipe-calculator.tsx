import { useState } from 'react';
import { router } from 'expo-router';
import {
  View, Text, TextInput, Pressable,
} from 'react-native';

import { useAppTheme } from '@/providers/theme';
import {
  formatAmount, type Variant,
} from '@/lib/recipe-model';

import {
  normalizeUnit,
  compatibleUnits,
  parseOutput,
  convertOutput,
  calculateFactor,
  scaleQuantity,
} from '@/lib/recipe-calculator';

export function RecipeCalculator({
  variant,
  recipeName,
}: {
  variant: Variant;
  recipeName: string;
}) {
  const { colors } = useAppTheme();

  const standard = Number(variant.yield_amount);
  const standardUnit = normalizeUnit(
    variant.yield_unit ?? ''
  );

  const isMors = /^морс/i.test(recipeName.trim()) &&
    compatibleUnits(standardUnit).includes('л');

  const initialUnit = isMors ? 'л' : standardUnit;
  const initialAmount = convertOutput(
    standard, standardUnit, initialUnit
  ) ?? standard;

  const [unit, setUnit] = useState(initialUnit);
  const [value, setValue] = useState(String(initialAmount));

  const target = parseOutput(value);
  const factor = target === null ? null : calculateFactor(
    standard, standardUnit, target, unit
  );

  function reset() {
    setUnit(initialUnit);
    setValue(String(initialAmount));
  }

  function changeUnit(next: string) {
    if (target !== null) {
      const converted = convertOutput(target, unit, next);
      if (converted !== null) setValue(String(converted));
    }
    setUnit(next);
  }

  const chip = {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  };

  return (
    <View style={{
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      gap: 12,
    }}>
      <Text style={{
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
      }}>
        Калькулятор ПФ
      </Text>

      <Text style={{ color: colors.muted, fontSize: 13 }}>
        Стандартный выход: {formatAmount(standard, standardUnit)}
      </Text>

      {isMors && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 5, 10].map(n => {
            const selected = unit === 'л' && target === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setUnit('л');
                  setValue(String(n));
                }}
                style={{
                  ...chip,
                  flex: 1,
                  alignItems: 'center',
                  borderColor: selected
                    ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? colors.primary : colors.input,
                }}
              >
                <Text style={{
                  color: selected
                    ? colors.onPrimary : colors.text,
                  fontWeight: '600',
                }}>
                  {n} л
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={{ color: colors.text, fontSize: 13 }}>
        Необходимый выход
      </Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          accessibilityLabel="Необходимый выход"
          placeholder="Количество"
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            color: colors.text,
            backgroundColor: colors.input,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            fontSize: 18,
          }}
        />

        {compatibleUnits(standardUnit).map(u => (
          <Pressable
            key={u}
            accessibilityRole="button"
            accessibilityState={{ selected: unit === u }}
            onPress={() => changeUnit(u)}
            style={{
              ...chip,
              justifyContent: 'center',
              borderColor: unit === u
                ? colors.accent : colors.border,
            }}
          >
            <Text style={{ color: colors.text }}>{u}</Text>
          </Pressable>
        ))}
      </View>

      {factor === null && (
        <Text style={{ color: colors.error, fontSize: 12 }}>
          Введите положительное количество.
        </Text>
      )}

      <Text style={{
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
      }}>
        Состав
      </Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Text style={{ color: colors.muted, flex: 1, fontSize: 11 }}>
          Ингредиент
        </Text>
        <Text style={{
          color: colors.muted, width: 76,
          textAlign: 'right', fontSize: 11,
        }}>
          Стандарт
        </Text>
        <Text style={{
          color: colors.muted, width: 90,
          textAlign: 'right', fontSize: 11,
        }}>
          Необходимо
        </Text>
      </View>

      {variant.items.map(item => (
        <View key={item.id} style={{
          flexDirection: 'row',
          gap: 8,
          borderTopWidth: 1,
          borderColor: colors.border,
          paddingVertical: 10,
        }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: colors.text, fontSize: 13 }}>
              {item.ingredient?.name ?? 'Ингредиент недоступен'}
            </Text>

            {!!item.notes && (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {item.notes}
              </Text>
            )}

            {!!item.ingredient?.prep_recipe_id && (
              <Pressable onPress={() => router.push({
                pathname: '/recipes/[id]',
                params: {
                  id: String(item.ingredient!.prep_recipe_id),
                },
              })}>
                <Text style={{ color: colors.accent, fontSize: 12 }}>
                  Открыть ТТК заготовки
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={{
            color: colors.muted,
            width: 76,
            fontSize: 12,
            textAlign: 'right',
          }}>
            {formatAmount(item.quantity, item.unit)}
          </Text>

          <Text style={{
            color: colors.accent,
            width: 90,
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'right',
          }}>
            {factor === null ? '—' :
              formatAmount(
                scaleQuantity(item.quantity, factor),
                item.unit
              )}
          </Text>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={reset}
        style={{
          ...chip,
          borderColor: colors.border,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.text }}>
          Вернуть стандартную рецептуру
        </Text>
      </Pressable>

      <Text style={{ color: colors.muted, fontSize: 11 }}>
        Расчёт не изменяет исходную ТТК.
      </Text>
    </View>
  );
}
