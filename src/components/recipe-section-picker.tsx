import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/theme';
import { blockUpdates } from '@/lib/update-guard';

type Section = {
  id: number;
  name: string;
};

export function RecipeSectionPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();

  const [sections, setSections] = useState<Section[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('recipe_sections')
        .select('id,name')
        .eq('is_archived', false)
        .order('sort_order')
        .order('name');

      if (error) throw error;

      setSections(data ?? []);
    } catch (e) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String(e.message)
          : 'Не удалось загрузить разделы.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    if (lock.current || disabled) return;

    const title = name.trim();

    if (!title || title.length > 100) {
      setError('Введите название раздела до 100 символов.');
      return;
    }

    if (sections.some(s =>
      s.name.toLowerCase() === title.toLowerCase()
    )) {
      setError('Такой раздел уже существует.');
      return;
    }

    lock.current = true;
    setBusy(true);
    setError('');
    const unblock = blockUpdates();

    try {
      const { data, error } = await supabase.rpc(
        'bm_recipe_section_create',
        { p_name: title }
      );

      if (error) throw error;

      setSections(old => [
        ...old,
        { id: Number(data), name: title },
      ]);

      onChange(title);
      setName('');
      setAdding(false);
      setExpanded(false);
      setQuery('');
    } catch (e) {
      setError(
        e && typeof e === 'object' && 'message' in e
          ? String(e.message)
          : 'Не удалось создать раздел.'
      );
    } finally {
      unblock();
      lock.current = false;
      setBusy(false);
    }
  }

  const filtered = sections.filter(s =>
    s.name.toLowerCase().includes(
      query.trim().toLowerCase()
    )
  );

  const inputStyle = {
    color: colors.text,
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 7,
    padding: 9,
    minHeight: 40,
    fontSize: 13,
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={{
        color: colors.muted,
        fontSize: 12,
      }}>
        Раздел
      </Text>

      <Pressable
        disabled={disabled || busy || loading}
        onPress={() => {
          setExpanded(v => !v);
          setAdding(false);
          setQuery('');
        }}
        style={{
          ...inputStyle,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text style={{
          flex: 1,
          color: value ? colors.text : colors.muted,
          fontSize: 13,
        }}>
          {loading
            ? 'Загрузка разделов…'
            : value || 'Выберите раздел'}
        </Text>

        <Text style={{ color: colors.accent }}>
          {expanded ? '⌃' : '⌄'}
        </Text>
      </Pressable>

      {expanded && <View style={{
        backgroundColor: colors.surface,
        padding: 7,
        borderRadius: 8,
        gap: 4,
      }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск раздела"
          placeholderTextColor={colors.muted}
          style={inputStyle}
        />

        {filtered.slice(0, 6).map(section => (
          <Pressable
            key={section.id}
            onPress={() => {
              onChange(section.name);
              setExpanded(false);
              setQuery('');
            }}
            style={{
              padding: 9,
              borderRadius: 6,
              backgroundColor: value === section.name
                ? colors.primary
                : colors.input,
            }}
          >
            <Text style={{
              color: value === section.name
                ? colors.onPrimary
                : colors.text,
              fontSize: 13,
            }}>
              {section.name}
            </Text>
          </Pressable>
        ))}

        {filtered.length > 6 &&
          <Text style={{
            color: colors.muted,
            fontSize: 11,
          }}>
            Уточните поиск для остальных разделов
          </Text>}

        {!filtered.length &&
          <Text style={{ color: colors.muted }}>
            Разделы не найдены
          </Text>}
      </View>}

      {!adding && <Pressable
        disabled={disabled || busy || loading}
        onPress={() => {
          setAdding(true);
          setExpanded(false);
          setError('');
        }}
        style={{ paddingVertical: 5 }}
      >
        <Text style={{
          color: colors.accent,
          fontSize: 13,
          fontWeight: '600',
        }}>
          + Создать раздел
        </Text>
      </Pressable>}

      {adding && <View style={{
        padding: 8,
        borderRadius: 8,
        backgroundColor: colors.surface,
        gap: 7,
      }}>
        <TextInput
          editable={!busy}
          value={name}
          onChangeText={setName}
          placeholder="Название нового раздела"
          placeholderTextColor={colors.muted}
          maxLength={100}
          style={inputStyle}
        />

        <View style={{
          flexDirection: 'row',
          gap: 6,
        }}>
          <Pressable
            disabled={busy}
            onPress={() => {
              setAdding(false);
              setName('');
              setError('');
            }}
            style={{
              flex: 1,
              padding: 9,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.muted }}>
              Отмена
            </Text>
          </Pressable>

          <Pressable
            disabled={busy || !name.trim()}
            onPress={create}
            style={{
              flex: 1,
              padding: 9,
              borderRadius: 7,
              backgroundColor: colors.primary,
              alignItems: 'center',
              opacity: busy || !name.trim() ? 0.5 : 1,
            }}
          >
            <Text style={{ color: colors.onPrimary }}>
              {busy ? 'Создаём…' : 'Создать'}
            </Text>
          </Pressable>
        </View>
      </View>}

      {!!error && <View style={{ gap: 5 }}>
        <Text style={{
          color: colors.error,
          fontSize: 12,
        }}>
          {error}
        </Text>
        <Pressable disabled={busy} onPress={load}>
          <Text style={{ color: colors.accent }}>
            Обновить разделы
          </Text>
        </Pressable>
      </View>}
    </View>
  );
}
