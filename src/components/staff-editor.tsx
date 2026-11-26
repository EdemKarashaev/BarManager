import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
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

export function StaffEditor({
  employee,
  onClose,
  onSaved,
}: {
  employee: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useAppTheme();

  const [firstName, setFirstName] = useState(
    employee.first_name ?? ''
  );
  const [lastName, setLastName] = useState(
    employee.last_name ?? ''
  );
  const [email, setEmail] = useState(employee.email ?? '');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');

  const [role, setRole] = useState(
    String(employee.role_id ?? '')
  );
  const [restaurant, setRestaurant] = useState(
    String(employee.location_id ?? '')
  );

  const [roles, setRoles] = useState<Option[]>([]);
  const [restaurants, setRestaurants] = useState<Option[]>([]);
  const [blocked, setBlocked] = useState(!!employee.is_blocked);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [opened, setOpened] = useState('');
  const lock = useRef(false);

  const protectedAccount = Number(employee.role_id) === 2;
  const userId = String(employee.user_id ?? employee.id);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    async function load() {
      try {
        const { data, error } = await supabase
          .rpc('bm_registration_options')
          .abortSignal(controller.signal);

        if (error) throw error;

        const payload = typeof data === 'string'
          ? JSON.parse(data)
          : data;

        const result = Array.isArray(payload)
          ? payload[0]
          : payload;

        if (!Array.isArray(result?.roles) ||
            !Array.isArray(result?.restaurants)) {
          throw new Error('Некорректный ответ сервера');
        }

        if (active) {
          setRoles(result.roles);
          setRestaurants(result.restaurants);
        }
      } catch {
        if (active) {
          setOptionsError('Не удалось загрузить должности и рестораны');
        }
      } finally {
        clearTimeout(timer);
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  async function save(
    action: string,
    payload: Record<string, unknown> = {}
  ) {
    if (lock.current || protectedAccount) return;

    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    setConfirm('');

    try {
      if (action === 'assignment') {
        const { error } = await supabase.rpc(
          'bm_staff_change_assignment',
          {
            p_user_id: userId,
            p_role_id: Number(role),
            p_location_id: restaurant,
          }
        );

        if (error) throw error;
      } else {
        const { data, error } = await supabase.functions.invoke(
          'manage-staff',
          {
            body: {
              user_id: userId,
              action,
              ...payload,
            },
          }
        );

        if (error) {
          let detail = error.message;

          try {
            const result = await error.context?.json();
            detail = result?.error || detail;
          } catch {}

          throw new Error(detail);
        }

        if (!data?.ok) {
          throw new Error(data?.error || 'Изменения не сохранены');
        }

        if (data.warning) {
          setError(data.warning);
        }
      }

      if (action === 'block') setBlocked(true);
      if (action === 'unblock') setBlocked(false);

      if (action === 'update_password') {
        setPassword('');
        setRepeat('');
      }

      setMessage('Изменения сохранены');
      onSaved();

    } catch (e: any) {
      setError(e?.message ?? 'Не удалось сохранить изменения');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const field = {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 16,
  };

  const panel = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  };

  function heading(title: string) {
    return (
      <Text style={{
        color: colors.text,
        fontSize: 17,
        fontWeight: '700',
      }}>
        {title}
      </Text>
    );
  }

  function button(
    title: string,
    action: () => void,
    disabled = false,
    danger = false
  ) {
    const unavailable = busy || protectedAccount || disabled;

    return (
      <Pressable
        disabled={unavailable}
        onPress={action}
        style={{
          padding: 13,
          borderRadius: 10,
          backgroundColor: danger ? '#B91C1C' : colors.primary,
          opacity: unavailable ? 0.4 : 1,
        }}
      >
        <Text style={{
          color: '#FFFFFF',
          textAlign: 'center',
          fontWeight: '600',
        }}>
          {title}
        </Text>
      </Pressable>
    );
  }

  function picker(
    key: string,
    options: Option[],
    value: string,
    change: (value: string) => void,
    placeholder: string
  ) {
    return (
      <View style={{ gap: 5 }}>
        <Pressable
          disabled={busy || protectedAccount || loading || !options.length}
          onPress={() => setOpened(opened === key ? '' : key)}
          style={field}
        >
          <Text style={{ color: colors.text }}>
            {options.find(o => String(o.id) === value)?.name
              ?? placeholder} ▾
          </Text>
        </Pressable>

        {opened === key && options.map(o => (
          <Pressable
            key={String(o.id)}
            disabled={busy || protectedAccount}
            style={{
              ...field,
              backgroundColor: String(o.id) === value
                ? colors.surface
                : colors.input,
            }}
            onPress={() => {
              change(String(o.id));
              setOpened('');
            }}
          >
            <Text style={{ color: colors.text }}>
              {o.name}
              {String(o.id) === value ? ' ✓' : ''}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function confirmation(
    action: string,
    title: string,
    payload: Record<string, unknown> = {}
  ) {
    return confirm === action ? (
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.error }}>
          Подтвердите действие: {title}
        </Text>
        {button('Подтвердить', () => void save(action, payload))}
        <Pressable onPress={() => setConfirm('')}>
          <Text style={{
            color: colors.muted,
            textAlign: 'center',
            padding: 8,
          }}>
            Отмена
          </Text>
        </Pressable>
      </View>
    ) : button(title, () => {
      setMessage('');
      setError('');
      setConfirm(action);
    }, false, action === 'block');
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!lock.current) onClose();
      }}
    >
      <View style={{
        flex: 1,
        backgroundColor: '#00000088',
        justifyContent: 'center',
        padding: 14,
      }}>
        <View style={{
          backgroundColor: colors.background,
          borderRadius: 20,
          width: '100%',
          maxWidth: 520,
          maxHeight: '92%',
          alignSelf: 'center',
        }}>
          <View style={{
            padding: 18,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{
              color: colors.text,
              fontSize: 21,
              fontWeight: '700',
            }}>
              Сотрудник
            </Text>

            <Pressable disabled={busy} onPress={onClose}>
              <Text style={{
                color: colors.muted,
                fontSize: 28,
              }}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 16,
              gap: 12,
            }}
          >
            {heading(employee.full_name || employee.name || employee.email)}

            <Text style={{
              color: blocked ? colors.error : colors.success,
            }}>
              {blocked ? 'Заблокирован' : 'Активен'}
            </Text>

            {protectedAccount && (
              <Text style={{ color: colors.muted }}>
                Аккаунт администратора защищён от редактирования.
              </Text>
            )}

            <View style={panel}>
              {heading('Личные данные')}

              <TextInput
                style={field}
                placeholder="Имя"
                placeholderTextColor={colors.muted}
                value={firstName}
                onChangeText={setFirstName}
                editable={!busy && !protectedAccount}
                maxLength={80}
              />

              <TextInput
                style={field}
                placeholder="Фамилия"
                placeholderTextColor={colors.muted}
                value={lastName}
                onChangeText={setLastName}
                editable={!busy && !protectedAccount}
                maxLength={80}
              />

              {button(
                'Сохранить имя и фамилию',
                () => void save('update_profile', {
                  first_name: firstName.trim(),
                  last_name: lastName.trim(),
                }),
                !firstName.trim() || !lastName.trim()
              )}
            </View>

            <View style={panel}>
              {heading('Электронная почта')}

              <TextInput
                style={field}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!busy && !protectedAccount}
              />

              {confirmation('update_email', 'Изменить email', {
                email: email.trim(),
              })}
            </View>

            <View style={panel}>
              {heading('Должность и ресторан')}

              {loading && <ActivityIndicator color={colors.accent} />}

              {!!optionsError && (
                <Text style={{ color: colors.error }}>
                  {optionsError}
                </Text>
              )}

              {picker(
                'role', roles, role, setRole,
                employee.role_name || 'Выберите должность'
              )}

              {picker(
                'restaurant', restaurants, restaurant,
                setRestaurant,
                employee.location_name || 'Выберите ресторан'
              )}

              {button(
                'Сохранить назначение',
                () => setConfirm('assignment'),
                loading || !!optionsError || !role || !restaurant
              )}

              {confirm === 'assignment' && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.error }}>
                    Изменятся права сотрудника и доступ к ресторану.
                  </Text>
                  {button(
                    'Подтвердить назначение',
                    () => void save('assignment')
                  )}
                  <Pressable onPress={() => setConfirm('')}>
                    <Text style={{
                      color: colors.muted,
                      textAlign: 'center',
                    }}>Отмена</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={panel}>
              {heading('Смена пароля')}

              <TextInput
                style={field}
                placeholder="Новый пароль"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!busy && !protectedAccount}
              />

              <TextInput
                style={field}
                placeholder="Повторите пароль"
                placeholderTextColor={colors.muted}
                value={repeat}
                onChangeText={setRepeat}
                secureTextEntry
                editable={!busy && !protectedAccount}
              />

              {password.length >= 6 && password === repeat
                ? confirmation(
                    'update_password',
                    'Установить новый пароль',
                    { password }
                  )
                : button('Установить новый пароль', () => {}, true)}
            </View>

            <View style={panel}>
              {heading('Доступ к приложению')}

              {confirmation(
                blocked ? 'unblock' : 'block',
                blocked
                  ? 'Разблокировать сотрудника'
                  : 'Заблокировать сотрудника'
              )}
            </View>
          </ScrollView>

          {(busy || !!message || !!error) && (
            <View style={{
              padding: 14,
              gap: 5,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}>
              {busy && <ActivityIndicator color={colors.accent} />}

              {!!message && (
                <Text style={{
                  color: colors.success,
                  textAlign: 'center',
                }}>{message}</Text>
              )}

              {!!error && (
                <Text style={{
                  color: colors.error,
                  textAlign: 'center',
                }}>{error}</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
