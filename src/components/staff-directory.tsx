import { StaffEditor } from '@/components/staff-editor';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppTheme } from '@/providers/theme';
import { supabase } from '@/lib/supabase';

export function StaffDirectory() {
  const { colors } = useAppTheme();

  const [employees, setEmployees] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState('');
  const [role, setRole] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('bm_staff_list');

      if (error) throw error;

      setEmployees(
        Array.isArray(data)
          ? data.filter(item => item.role_id != null)
          : []
      );
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить сотрудников');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roles = [...new Set(
    employees.map(item => String(item.role_name ?? ''))
  )].filter(Boolean);

  const filtered = employees.filter(item => {
    const value = [
      item.full_name,
      item.name,
      item.email,
      item.role_name,
      item.location_name,
    ].join(' ').toLowerCase();

    return value.includes(search.trim().toLowerCase())
      && (!role || item.role_name === role);
  });

  return (
    <View style={{ gap: 12 }}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Поиск сотрудников"
        placeholderTextColor={colors.muted}
        style={{
          color: colors.text,
          backgroundColor: colors.input,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          padding: 12,
        }}
      />

      <View style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        {['', ...roles].map(item => (
          <Pressable
            key={item || 'all'}
            onPress={() => setRole(item)}
            style={{
              backgroundColor: role === item
                ? colors.primary
                : colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 8,
              padding: 9,
            }}
          >
            <Text style={{
              color: role === item
                ? colors.onPrimary
                : colors.text,
            }}>
              {item || 'Все'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ color: colors.muted }}>
          Сотрудников: {filtered.length}
        </Text>

        <Pressable disabled={loading} onPress={() => void load()}>
          <Text style={{ color: colors.accent }}>
            Обновить
          </Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator color={colors.accent} />}

      {!!error && (
        <Text style={{ color: colors.error }}>{error}</Text>
      )}

      {filtered.map((item, index) => {
        const id = String(item.user_id ?? item.id ?? index);
        const devices = Array.isArray(item.devices)
          ? item.devices
          : [];

        return (
          <View key={id} style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 14,
            gap: 7,
          }}>
            <Pressable
              onPress={() => setEditing(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <Text style={{
                color: colors.text,
                fontSize: 17,
                fontWeight: '700',
                flex: 1,
              }}>
                {item.full_name || item.name || item.email}
              </Text>

              <Text style={{
                color: colors.accent,
                fontSize: 21,
              }}>✎</Text>
            </Pressable>

            <Text style={{ color: colors.muted }}>
              {item.email}
            </Text>

            <Text style={{
              color: colors.accent,
              fontWeight: '600',
            }}>
              {item.role_name}
            </Text>

            <Text style={{ color: colors.text }}>
              {item.location_name || 'Ресторан не назначен'}
            </Text>

            <Text style={{
              color: item.is_blocked
                ? colors.error
                : colors.success,
              fontSize: 12,
            }}>
              {item.is_blocked ? 'Заблокирован' : 'Активен'}
            </Text>

            <Pressable onPress={() =>
              setExpanded(expanded === id ? '' : id)
            }>
              <Text style={{ color: colors.muted }}>
                Устройства: {devices.length}
                {expanded === id ? ' ▴' : ' ▾'}
              </Text>
            </Pressable>

            {expanded === id && devices.map((device: any, i: number) => (
              <View key={device.id ?? i} style={{
                borderTopWidth: 1,
                borderColor: colors.border,
                paddingTop: 10,
                gap: 4,
              }}>
                <Text style={{ color: colors.text }}>
                  {device.device_name || device.platform}
                </Text>

                <Text style={{ color: colors.muted }}>
                  Версия: {device.app_version || '—'}
                </Text>

                <Text style={{ color: colors.muted }}>
                  Последняя активность: {
                    device.last_seen_at
                      ? new Date(device.last_seen_at)
                          .toLocaleString('ru-RU')
                      : '—'
                  }
                </Text>
              </View>
            ))}
          </View>
        );
      })}

      {editing && (
        <StaffEditor
          key={String(editing.user_id ?? editing.id)}
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </View>
  );
}
