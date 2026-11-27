import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useAppTheme } from '@/providers/theme';
import { OrderCyclesList } from './order-cycles-list';
import {
  createOrderCycle,
  rescheduleOrderCycle,
  orderError,
  type OrderCycle,
} from '@/lib/orders-api';

type Props = {
  selected: OrderCycle | null;
  week: string;
  disabled?: boolean;
  onSelect: (cycle: OrderCycle) => void;
};

export function OrderCycleManager({
  selected,
  week,
  disabled = false,
  onSelect,
}: Props) {
  const { colors } = useAppTheme();

  const [mode, setMode] =
    useState<'create' | 'edit' | null>(null);

  const [name, setName] = useState('Дополнительный заказ');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('13:00');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const locked = disabled || saving;

  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  };

  function start(next: 'create' | 'edit') {
    setError('');
    setMessage('');
    setMode(next);

    const value = next === 'edit' && selected
      ? new Date(selected.check_at)
      : new Date(Date.now() + 86400000);

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);

    const part = (key: string) =>
      parts.find(p => p.type === key)?.value ?? '';

    setDate(`${part('year')}-${part('month')}-${part('day')}`);

    setTime(next === 'edit'
      ? `${part('hour')}:${part('minute')}`
      : '13:00');

    setName('Дополнительный заказ');
  }

  async function save() {
    if (locked || !mode) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError('Укажите дату ГГГГ-ММ-ДД и время ЧЧ:ММ.');
      return;
    }

    const deadline = new Date(`${date}T${time}:00+03:00`);

    if (!Number.isFinite(deadline.getTime()) ||
        deadline.getTime() <= Date.now()) {
      setError('Дата проверки должна быть в будущем.');
      return;
    }

    if (mode === 'create' && !name.trim()) {
      setError('Введите название заказа.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (mode === 'create') {
        await createOrderCycle(name.trim(), date, time);
        setMessage('Дополнительный заказ создан.');
      } else if (selected) {
        await rescheduleOrderCycle(selected.id, date, time);

        onSelect({
          ...selected,
          check_at: deadline.toISOString(),
        });

        setMessage('Дата проверки изменена.');
      }

      setMode(null);
      setReload(v => v + 1);
    } catch (e) {
      setError(orderError(e));
    } finally {
      setSaving(false);
    }
  }

  function button(
    title: string,
    action: () => void,
    blocked = false,
  ) {
    return (
      <Pressable
        disabled={locked || blocked}
        onPress={action}
        style={{
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: locked || blocked ? 0.45 : 1,
        }}
      >
        <Text style={{
          color: colors.accent,
          textAlign: 'center',
          fontWeight: '600',
        }}>
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{
      gap: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    }}>
      <Text style={{
        color: colors.text,
        fontSize: 17,
        fontWeight: '600',
      }}>
        Управление заказами
      </Text>

      <OrderCyclesList
        key={reload}
        selectedId={selected?.id ?? null}
        selectedWeek={week}
        disabled={locked || !!mode}
        onSelect={onSelect}
      />

      {button('+ Создать дополнительный заказ',
        () => start('create'), !!mode)}

      {button('Изменить дату проверки',
        () => start('edit'),
        !!mode || !selected ||
        !['planned', 'open'].includes(selected.status) ||
        !!selected.checked_at)}

      {mode && (
        <View style={{ gap: 8 }}>
          {mode === 'create' && (
            <TextInput
              style={inputStyle}
              value={name}
              onChangeText={setName}
              editable={!locked}
              maxLength={150}
              placeholder="Название заказа"
              placeholderTextColor={colors.muted}
            />
          )}

          <Text style={{ color: colors.muted }}>
            Дата проверки (ГГГГ-ММ-ДД)
          </Text>

          <TextInput
            style={inputStyle}
            value={date}
            onChangeText={setDate}
            editable={!locked}
            maxLength={10}
          />

          <Text style={{ color: colors.muted }}>
            Время проверки (МСК)
          </Text>

          <TextInput
            style={inputStyle}
            value={time}
            onChangeText={setTime}
            editable={!locked}
            maxLength={5}
          />

          {button(saving ? 'Сохранение…' : 'Сохранить',
            () => void save())}

          {button('Отмена', () => setMode(null))}
        </View>
      )}

      {!!error && (
        <Text style={{ color: colors.error }}>{error}</Text>
      )}

      {!!message && (
        <Text style={{ color: colors.success }}>{message}</Text>
      )}

      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Открытие и закрытие дополнительных заказов
        станет доступно после обновления сервера.
      </Text>
    </View>
  );
}
