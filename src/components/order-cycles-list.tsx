import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/providers/theme';
import {
  fetchOrderCycles,
  formatCycleDate,
  cycleStatus,
  type OrderCycle,
  orderError,
} from '@/lib/orders-api';
import { OrderCyclePicker } from './order-cycle-picker';

type Props = {
  selectedId: string | null;
  selectedWeek?: string;
  onSelect: (cycle: OrderCycle) => void;
  disabled?: boolean;
};

export function OrderCyclesList({
  selectedId,
  selectedWeek,
  onSelect,
  disabled = false,
}: Props) {
  const { colors } = useAppTheme();

  const [cycles, setCycles] = useState<OrderCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError('');

      fetchOrderCycles()
        .then((data) => {
          if (active) setCycles(data);
        })
        .catch((e) => {
          if (active) setError(orderError(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [reload])
  );

  if (loading) {
    return <ActivityIndicator color={colors.accent} />;
  }

  if (error) {
    return (
      <View style={{ padding: 12, gap: 8 }}>
        <Text style={{ color: colors.error }}>
          {error}
        </Text>
        <Pressable onPress={() => setReload(v => v + 1)}>
          <Text style={{ color: colors.accent }}>
            Повторить загрузку
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!cycles.length) {
    return (
      <Text style={{ color: colors.muted, padding: 12 }}>
        Нет доступных периодов заказа
      </Text>
    );
  }

  const selected = cycles.find(c => c.id === selectedId)
    ?? cycles.find(c =>
      c.cycle_type === "regular" &&
      c.week_start === selectedWeek
    );

  return (
    <View>
      <OrderCyclePicker
        cycles={cycles}
        selectedId={selected?.id ?? null}
        onSelect={onSelect}
        disabled={disabled}
      />

      {selected && (
        <View style={{ paddingBottom: 12, gap: 4 }}>
          <Text style={{ color: colors.muted }}>
            Проверка: {formatCycleDate(selected.check_at)}
          </Text>
          <Text style={{ color: colors.muted }}>
            Статус: {cycleStatus[selected.status]}
          </Text>
        </View>
      )}
    </View>
  );
}
