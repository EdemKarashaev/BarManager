import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

import { useAppTheme } from '@/providers/theme';

import {
  type OrderCycle,
  cycleStatus,
  formatCycleDate,
} from '@/lib/orders-api';

type Props = {
  cycles: OrderCycle[];
  selectedId: string | null;
  onSelect: (cycle: OrderCycle) => void;
  disabled?: boolean;
};

export function OrderCyclePicker({
  cycles,
  selectedId,
  onSelect,
  disabled = false,
}: Props) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  const selected = cycles.find(
    (cycle) => cycle.id === selectedId
  );

  return (
    <View
      style={[
        s.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[s.label, { color: colors.muted }]}>
        Период заказа
      </Text>

      <Pressable
        disabled={disabled}
        onPress={() => setExpanded((v) => !v)}
        style={s.header}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.text }]}>
            {selected?.name ?? 'Выберите заказ'}
          </Text>

          {selected && (
            <Text
              style={[s.date, { color: colors.muted }]}
            >
              {formatCycleDate(selected.check_at)}
            </Text>
          )}
        </View>

        <Text style={{ color: colors.accent, fontSize: 20 }}>
          {expanded ? '⌃' : '⌄'}
        </Text>
      </Pressable>

      {selected && (
        <Text
          style={{
            color:
              selected.status === 'open'
                ? colors.success
                : colors.muted,
            fontSize: 12,
            marginTop: 6,
          }}
        >
          {cycleStatus[selected.status]}
        </Text>
      )}

      {expanded && !disabled && (
        <View style={{ marginTop: 10 }}>
          {cycles.map((cycle) => (
            <Pressable
              key={cycle.id}
              onPress={() => {
                setExpanded(false);
                onSelect(cycle);
              }}
              style={[
                s.option,
                {
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.title,
                    { color: colors.text },
                  ]}
                >
                  {cycle.name}
                </Text>

                <Text
                  style={[
                    s.date,
                    { color: colors.muted },
                  ]}
                >
                  {formatCycleDate(cycle.check_at)}
                  {' · '}
                  {cycleStatus[cycle.status]}
                </Text>
              </View>

              {cycle.id === selectedId && (
                <Text style={{ color: colors.accent }}>
                  ✓
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    marginTop: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 12,
    gap: 10,
  },
});
