import { RecipeCreate } from '@/components/recipe-create';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { useAppTheme } from '@/providers/theme';
import { blockUpdates } from '@/lib/update-guard';
import type {
  Recipe,
  RecipeStatus,
} from '@/lib/recipe-model';

type Action = 'archive' | 'restore';

export function RecipeAdminMenu({
  recipe,
  onChanged,
  disabled,
}: {
  recipe: Recipe;
  onChanged: () => void;
  disabled?: boolean;
}) {
  const { staff, offline } = useAuth();
  const { colors, mode } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Action | null>(null);
  const lock = useRef(false);

  const statuses: {
    value: RecipeStatus;
    label: string;
    color: string;
  }[] = [
    {
      value: 'coming_soon',
      label: 'На ввод',
      color: mode === 'light' ? '#187747' : '#79D5A4',
    },
    {
      value: 'active',
      label: 'В меню',
      color: colors.muted,
    },
    {
      value: 'phasing_out',
      label: 'На вывод',
      color: mode === 'light' ? '#CC0014' : '#FF8B8B',
    },
  ];

  if (!staff?.isAdmin) return null;

  const unavailable =
    disabled || offline || recipe.revision == null;

  function close() {
    if (lock.current) return;
    setOpen(false);
    setConfirm(null);
    setError('');
  }

  async function change(
    action: Action | 'status',
    status?: RecipeStatus,
  ) {
    if (lock.current || unavailable) return;

    lock.current = true;
    setBusy(true);
    setError('');
    const unblock = blockUpdates();

    try {
      const result = action === 'status'
        ? await supabase.rpc('bm_recipe_set_status', {
            p_recipe_id: recipe.id,
            p_status: status,
            p_expected_status: recipe.status,
          })
        : await supabase.rpc('bm_recipe_set_visibility', {
            p_recipe_id: recipe.id,
            p_action: action,
            p_expected_revision: recipe.revision,
          });

      if (result.error) throw result.error;

      setOpen(false);
      setConfirm(null);
      onChanged();
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String(e.message)
          : 'Не удалось сохранить изменение.';

      setError(message);
      setConfirm(null);
    } finally {
      unblock();
      lock.current = false;
      setBusy(false);
    }
  }

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Управление ТТК"
      disabled={unavailable}
      onPress={() => {
        setError('');
        setConfirm(null);
        setOpen(true);
      }}
      style={{
        padding: 10,
        opacity: unavailable ? 0.4 : 1,
      }}
    >
      <Text style={{
        color: colors.accent,
        fontSize: 22,
        fontWeight: '700',
      }}>⋮</Text>
    </Pressable>

    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={{
        flex: 1,
        backgroundColor: '#00000088',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
      }}>
        <View style={{
          width: '100%',
          maxWidth: 360,
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 7,
        }}>
          <Text style={{
            color: colors.text,
            fontSize: 16,
            fontWeight: '700',
          }}>{recipe.name || 'ТТК'}</Text>

          {!confirm && (
            <RecipeCreate
              recipes={[recipe]}
              editRecipe={recipe}
              disabled={busy || unavailable}
              onCreated={() => {
                close();
                onChanged();
              }}
            />
          )}

          {!recipe.archived_at && !confirm &&
            statuses.map(item => (
              <Pressable
                key={item.value}
                disabled={busy || recipe.status === item.value}
                onPress={() => change('status', item.value)}
                style={{
                  padding: 10,
                  borderRadius: 7,
                  backgroundColor: colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <View style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: item.color,
                }} />
                <Text style={{
                  flex: 1,
                  color: item.color,
                  fontSize: 14,
                }}>{item.label}</Text>
                {recipe.status === item.value &&
                  <Text style={{ color: item.color }}>✓</Text>}
              </Pressable>
            ))
          }

          

          {!confirm &&
            <Pressable
              disabled={busy}
              onPress={() =>
                setConfirm(recipe.archived_at ? 'restore' : 'archive')
              }
              style={{ padding: 10 }}
            >
              <Text style={{ color: colors.error }}>
                {recipe.archived_at
                  ? 'Восстановить из архива'
                  : 'Перенести в архив'}
              </Text>
            </Pressable>
          }

          {confirm && <>
            <Text style={{
              color: colors.text,
              fontSize: 14,
            }}>
              {confirm === 'archive'
                ? 'Убрать ТТК из меню? Проверьте, не используется ли она в других рецептурах.'
                : 'Вернуть ТТК в меню для всех барменов?'}
            </Text>
            <Pressable
              disabled={busy}
              onPress={() => change(confirm)}
              style={{
                backgroundColor: colors.primary,
                padding: 10,
                borderRadius: 7,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.onPrimary }}>
                {busy ? 'Сохраняем…' : 'Подтвердить'}
              </Text>
            </Pressable>
          </>}

          {!!error &&
            <Text style={{
              color: colors.error,
              fontSize: 12,
            }}>{error}</Text>
          }

          <Pressable
            disabled={busy}
            onPress={close}
            style={{ padding: 10, alignItems: 'center' }}
          >
            <Text style={{ color: colors.muted }}>
              {busy ? 'Сохраняем…' : 'Закрыть'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </>;
}
