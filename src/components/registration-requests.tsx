import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '@/providers/theme';
import { supabase } from '@/lib/supabase';

type Option = {
  id: string | number;
  name: string;
};

type Request = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  email_confirmed: boolean;
  role_id: number;
  role_name: string;
  location_id: string;
  location_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason: string | null;
};

export function RegistrationRequests() {
  const { colors } = useAppTheme();

  const [requests, setRequests] = useState<Request[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [restaurants, setRestaurants] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState(false);

  const [selected, setSelected] = useState('');
  const [role, setRole] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [list, options] = await Promise.all([
        supabase.rpc('bm_registration_list'),
        supabase.rpc('bm_registration_options'),
      ]);

      if (list.error) throw list.error;
      if (options.error) throw options.error;

      setRequests(list.data ?? []);
      setRoles(options.data?.roles ?? []);
      setRestaurants(options.data?.restaurants ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить заявки.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function open(item: Request) {
    setSelected(item.id);
    setRole(String(item.role_id));
    setRestaurant(item.location_id);
    setRejecting(false);
    setReason('');
    setError('');
    setMessage('');
  }

  async function review(
    item: Request,
    action: 'approved' | 'rejected'
  ) {
    if (lock.current) return;



    if (action === 'approved' && (!role || !restaurant)) {
      setError('Выберите ресторан и должность.');
      return;
    }

    if (action === 'rejected' && !reason.trim()) {
      setError('Укажите причину отклонения.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.rpc(
        'bm_registration_review',
        {
          p_request_id: item.id,
          p_action: action,
          p_role_id: action === 'approved' ? Number(role) : null,
          p_location_id: action === 'approved' ? restaurant : null,
          p_reason: action === 'rejected' ? reason.trim() : null,
        }
      );

      if (error) throw error;

      setSelected('');
      setRejecting(false);
      setReason('');
      setMessage(
        action === 'approved'
          ? 'Заявка подтверждена.'
          : 'Заявка отклонена.'
      );

      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось обработать заявку.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const pending = requests.filter(r => r.status === 'pending');
  const visible = history
    ? requests.filter(r => r.status !== 'pending')
    : pending;

  function button(
    title: string,
    onPress: () => void,
    active = false,
    disabled = false
  ) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || busy}
        style={{
          padding: 11,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.input,
          opacity: disabled || busy ? 0.45 : 1,
        }}
      >
        <Text style={{
          color: active ? colors.onPrimary : colors.text,
          textAlign: 'center',
          fontWeight: '600',
        }}>
          {title}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        {button(
          'Ожидают (' + pending.length + ')',
          () => setHistory(false),
          !history
        )}
        {button('История', () => setHistory(true), history)}
        {button('Обновить', () => void load(), false, loading)}
      </View>

      {loading && <ActivityIndicator color={colors.accent} />}

      {!!error && (
        <Text style={{ color: colors.error }}>{error}</Text>
      )}

      {!!message && (
        <Text style={{ color: colors.success }}>{message}</Text>
      )}

      {!loading && !error && visible.length === 0 && (
        <Text style={{
          color: colors.muted,
          padding: 16,
          textAlign: 'center',
        }}>
          {history ? 'История пока пуста' : 'Новых заявок нет'}
        </Text>
      )}

      {visible.map(item => (
        <View
          key={item.id}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 14,
            gap: 10,
          }}
        >
          <Text style={{
            color: colors.text,
            fontWeight: '700',
            fontSize: 18,
          }}>
            {item.first_name} {item.last_name}
          </Text>

          <Text style={{ color: colors.muted }}>
            {item.email}
          </Text>

          <Text style={{
            color: item.email_confirmed
              ? colors.success
              : colors.error,
          }}>
            {item.email_confirmed
              ? 'Email указан'
              : 'Подтверждение почты не требуется'}
          </Text>

          <Text style={{ color: colors.text }}>
            Ресторан: {item.location_name}
          </Text>

          <Text style={{ color: colors.text }}>
            Должность: {item.role_name}
          </Text>

          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {new Date(item.created_at).toLocaleString('ru-RU')}
          </Text>

          {item.status === 'approved' && (
            <Text style={{ color: colors.success }}>
              Подтверждена
            </Text>
          )}

          {item.status === 'rejected' && (
            <Text style={{ color: colors.error }}>
              Отклонена: {item.rejection_reason}
            </Text>
          )}

          {item.status === 'pending' && selected !== item.id &&
            button('Рассмотреть заявку', () => open(item))
          }

          {item.status === 'pending' && selected === item.id && <>
            <Text style={{
              color: colors.muted,
              fontWeight: '600',
            }}>
              Выберите должность
            </Text>

            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
            }}>
              {roles.map(option => (
                <View key={String(option.id)}>
                  {button(
                    option.name,
                    () => setRole(String(option.id)),
                    role === String(option.id)
                  )}
                </View>
              ))}
            </View>

            <Text style={{
              color: colors.muted,
              fontWeight: '600',
            }}>
              Выберите ресторан
            </Text>

            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
            }}>
              {restaurants.map(option => (
                <View key={String(option.id)}>
                  {button(
                    option.name,
                    () => setRestaurant(String(option.id)),
                    restaurant === String(option.id)
                  )}
                </View>
              ))}
            </View>

            {!rejecting && <>
              {button(
                'Подтвердить',
                () => void review(item, 'approved'),
                true
              )}
              {button('Отклонить', () => setRejecting(true))}
            </>}

            {rejecting && <>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Причина отклонения"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={1000}
                editable={!busy}
                style={{
                  color: colors.text,
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  minHeight: 70,
                }}
              />
              {button(
                'Подтвердить отклонение',
                () => void review(item, 'rejected'),
                true,
                !reason.trim()
              )}
              {button('Назад', () => setRejecting(false))}
            </>}

            {button('Закрыть', () => setSelected(''))}
          </>}
        </View>
      ))}
    </View>
  );
}
