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

export function RegistrationModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [role, setRole] = useState('');

  const [restaurants, setRestaurants] = useState<Option[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);

  const [dropdown, setDropdown] =
    useState<'restaurant' | 'role' | null>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setLoading(true);
    setError('');
    setRestaurants([]);
    setRoles([]);
    setRestaurant('');
    setRole('');

    Promise.resolve(supabase.rpc('bm_registration_options'))
      .then(({ data, error }) => {
        if (!active) return;

        if (error || !data) {
          setError('Не удалось загрузить рестораны и должности.');
          return;
        }

        setRestaurants(data.restaurants ?? []);
        setRoles(data.roles ?? []);
      })
      .catch(() => {
        if (active) setError('Ошибка подключения.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [visible]);

  function close() {
    if (lock.current) return;
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setRepeat('');
    setRestaurant('');
    setRole('');
    setDropdown(null);
    setSuccess(false);
    setError('');
    onClose();
  }

  async function submit() {
    if (lock.current || loading) return;

    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Укажите имя и фамилию.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Укажите корректный email.');
      return;
    }

    if (!restaurant || !role) {
      setError('Выберите ресторан и должность.');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов.');
      return;
    }

    if (password !== repeat) {
      setError('Пароли не совпадают.');
      return;
    }

    lock.current = true;
    setBusy(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            registration_source: 'bar_manager',
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name:
              firstName.trim() + ' ' + lastName.trim(),
            requested_role_id: role,
            requested_location_id: restaurant,
          },
        },
      });

      if (error) throw error;

      setPassword('');
      setRepeat('');
      setSuccess(true);

    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Не удалось отправить заявку.'
      );
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
    color: colors.text,
    padding: 12,
    fontSize: 16,
  };

  function picker(
    kind: 'restaurant' | 'role',
    options: Option[],
    value: string,
    placeholder: string,
    change: (value: string) => void,
  ) {
    return (
      <View style={{ gap: 5 }}>
        <Pressable
          disabled={busy || loading}
          onPress={() =>
            setDropdown(dropdown === kind ? null : kind)
          }
          style={field}
        >
          <Text style={{ color: value ? colors.text : colors.muted }}>
            {options.find(o => String(o.id) === value)?.name
              ?? placeholder} ▾
          </Text>
        </Pressable>

        {dropdown === kind && options.map(o => (
          <Pressable
            key={String(o.id)}
            style={field}
            onPress={() => {
              change(String(o.id));
              setDropdown(null);
            }}
          >
            <Text style={{ color: colors.text }}>
              {o.name}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={{
        flex: 1,
        backgroundColor: '#00000088',
        justifyContent: 'center',
        padding: 16,
      }}>
        <View style={{
          backgroundColor: colors.background,
          borderRadius: 20,
          width: '100%',
          maxWidth: 440,
          maxHeight: '90%',
          alignSelf: 'center',
        }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Text style={{
                color: colors.text,
                fontSize: 24,
                fontWeight: '700',
              }}>Регистрация</Text>

              <Pressable disabled={busy} onPress={close}>
                <Text style={{
                  color: colors.muted,
                  fontSize: 26,
                }}>×</Text>
              </Pressable>
            </View>

            {success ? <>
              <Text style={{
                color: colors.success,
                fontSize: 20,
                fontWeight: '700',
              }}>Заявка отправлена</Text>

              <Text style={{
                color: colors.text,
                lineHeight: 22,
              }}>
                Дождитесь одобрения администратора.
                После этого вы сможете войти
                в приложение.
              </Text>

              <Pressable onPress={close} style={{
                backgroundColor: '#C0271F',
                padding: 14,
                borderRadius: 10,
              }}>
                <Text style={{
                  color: '#FFFFFF',
                  textAlign: 'center',
                }}>Понятно</Text>
              </Pressable>
            </> : <>
              <Text style={{ color: colors.muted }}>
                Заполните данные для получения доступа.
              </Text>

              <TextInput
                style={field}
                placeholder="Имя"
                placeholderTextColor={colors.muted}
                value={firstName}
                onChangeText={setFirstName}
                maxLength={80}
                editable={!busy}
              />

              <TextInput
                style={field}
                placeholder="Фамилия"
                placeholderTextColor={colors.muted}
                value={lastName}
                onChangeText={setLastName}
                maxLength={80}
                editable={!busy}
              />

              <TextInput
                style={field}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!busy}
              />

              {loading && <ActivityIndicator />}

              {picker(
                'restaurant', restaurants, restaurant,
                'Выберите ресторан', setRestaurant
              )}

              {picker(
                'role', roles, role,
                'Выберите должность', setRole
              )}

              <TextInput
                style={field}
                placeholder="Пароль (от 6 символов)"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!busy}
              />

              <TextInput
                style={field}
                placeholder="Повторите пароль"
                placeholderTextColor={colors.muted}
                value={repeat}
                onChangeText={setRepeat}
                secureTextEntry
                autoCapitalize="none"
                editable={!busy}
              />

              {!!error && <Text style={{ color: colors.error }}>
                {error}
              </Text>}

              <Pressable
                disabled={busy || loading || !restaurant || !role}
                onPress={() => void submit()}
                style={{
                  backgroundColor: '#C0271F',
                  padding: 15,
                  borderRadius: 10,
                  opacity: busy || loading ||
                    !restaurant || !role ? 0.5 : 1,
                }}
              >
                <Text style={{
                  color: '#FFFFFF',
                  textAlign: 'center',
                  fontWeight: '700',
                }}>
                  {busy ? 'Отправляем…' : 'Отправить заявку'}
                </Text>
              </Pressable>

              <Text style={{
                color: colors.muted,
                textAlign: 'center',
                fontSize: 12,
              }}>
                Доступ предоставляется после
                подтверждения администратором.
              </Text>
            </>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
