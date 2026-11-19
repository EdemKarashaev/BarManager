
import { supabase } from '@/lib/supabase';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tab = 'outgoing' | 'incoming' | 'history';

type Transfer = {
  id: string;
  from_location_id: string;
  to_location_id: string;
  created_by: string;
  status: string;
  created_at: string;
  sent_at: string | null;
};

type Location = {
  id: string;
  name: string;
};

const C = {
  bg: '#151518',
  card: '#242428',
  red: '#CC0014',
  white: '#FFFFFF',
  muted: '#AAAAAA',
  green: '#79D5A4',
  border: '#39393E',
};

const STATUS: Record<string, string> = {
  draft: 'Черновик',
  pending_receipt: 'Ожидает получения',
  pending_sender: 'Ожидает отправителя',
  completed: 'Завершено',
  disputed: 'Расхождение',
  cancelled: 'Отменено',
};

export default function TransfersScreen() {
  const [tab, setTab] = useState<Tab>('outgoing');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myLocations, setMyLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const userResult = await supabase.auth.getUser();

      if (userResult.error) throw userResult.error;

      const user = userResult.data.user;
      if (!user) throw new Error('Необходимо войти в приложение');

      const [transferResult, locationResult, accessResult] =
        await Promise.all([
          supabase
            .from('inventory_transfers')
            .select(
              'id,from_location_id,to_location_id,created_by,status,created_at,sent_at'
            )
            .order('created_at', { ascending: false })
            .limit(200),

          supabase
            .from('order_locations')
            .select('id,name'),

          supabase
            .from('order_user_access')
            .select('location_id')
            .eq('user_id', user.id),
        ]);

      if (transferResult.error) throw transferResult.error;
      if (locationResult.error) throw locationResult.error;
      if (accessResult.error) throw accessResult.error;

      const adminResult = await supabase.rpc('is_inventory_admin');

      if (adminResult.error) {
        throw adminResult.error;
      }

      setIsAdmin(adminResult.data === true);
      setUserId(user.id);
      setTransfers((transferResult.data ?? []) as Transfer[]);
      setLocations((locationResult.data ?? []) as Location[]);
      setMyLocations(
        (accessResult.data ?? []).map((item) => item.location_id)
      );
    } catch (e: unknown) {
  console.error('TRANSFERS LOAD ERROR:', e);

  const err = e as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  const message = [
    err?.message || 'Неизвестная ошибка',
    err?.code ? `Код: ${err.code}` : '',
    err?.details ? `Детали: ${err.details}` : '',
    err?.hint ? `Подсказка: ${err.hint}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  setError(message);
} finally {
  setLoading(false);
}
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function locationName(id: string) {
    return locations.find((item) => item.id === id)?.name ?? 'Ресторан';
  }

  const visibleTransfers = transfers.filter((transfer) => {
  const isSender =
    isAdmin ||
    transfer.created_by === userId ||
    myLocations.includes(transfer.from_location_id);

  const isRecipient =
    isAdmin ||
    myLocations.includes(transfer.to_location_id);

  if (tab === 'outgoing') {
    return (
      isSender &&
      !['completed', 'cancelled'].includes(transfer.status)
    );
  }

  if (tab === 'incoming') {
    return (
      isRecipient &&
      !['completed', 'cancelled', 'draft'].includes(
        transfer.status
      )
    );
  }

  return (
    (isAdmin || isSender || isRecipient) &&
    ['completed', 'cancelled'].includes(transfer.status)
  );
});

  async function sendDraft(transfer: Transfer) {
    if (sendingId) return;

    setSendingId(transfer.id);

    try {
      const result = await supabase.rpc(
        'send_inventory_transfer',
        { p_transfer_id: transfer.id }
      );

      if (result.error) throw result.error;

      Alert.alert(
        'Перемещение отправлено',
        `Документ отправлен в ресторан «${locationName(
          transfer.to_location_id
        )}».`
      );

      await load();
    } catch (e) {
      Alert.alert(
        'Ошибка отправки',
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setSendingId(null);
    }
  }

  function confirmSend(transfer: Transfer) {
    Alert.alert(
      'Отправить перемещение?',
      `${locationName(transfer.from_location_id)} → ${locationName(
        transfer.to_location_id
      )}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отправить',
          onPress: () => void sendDraft(transfer),
        },
      ]
    );
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Назад</Text>
      </Pressable>

      <Text style={styles.title}>Перемещения</Text>
      <Text style={styles.subtitle}>
        Перемещения товаров между ресторанами
      </Text>

      <Pressable
        style={styles.createButton}
        onPress={() => router.push('/transfers/create')}
      >
        <Text style={styles.buttonText}>
          + Создать перемещение
        </Text>
      </Pressable>

      <View style={styles.tabs}>
        {(
          [
            ['outgoing', 'Исходящие'],
            ['incoming', 'Входящие'],
            ['history', 'История'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={[
              styles.tab,
              tab === key && styles.activeTab,
            ]}
            onPress={() => setTab(key)}
          >
            <Text
              style={[
                styles.tabText,
                tab === key && styles.activeTabText,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.red} size="large" />
          <Text style={styles.muted}>Загружаем перемещения…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.retry}>Повторить</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          refreshControl={undefined}
        >
          {visibleTransfers.length === 0 ? (
            <Text style={styles.empty}>
              В этом разделе пока нет перемещений.
            </Text>
          ) : (
            visibleTransfers.map((transfer) => (
              <View key={transfer.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.route}>
                    {locationName(transfer.from_location_id)}
                    {' → '}
                    {locationName(transfer.to_location_id)}
                  </Text>
                </View>

                <Text style={styles.date}>
                  {formatDate(transfer.created_at)}
                </Text>

                <View style={styles.statusRow}>
                  <Text
                    style={[
                      styles.status,
                      transfer.status === 'completed' &&
                        styles.completed,
                    ]}
                  >
                    {STATUS[transfer.status] ??
                      transfer.status}
                  </Text>
                </View>

                {transfer.status === 'draft' &&
                  transfer.created_by === userId && (
                    <Pressable
                      disabled={sendingId !== null}
                      style={[
                        styles.sendButton,
                        sendingId !== null && styles.disabled,
                      ]}
                      onPress={() => confirmSend(transfer)}
                    >
                      {sendingId === transfer.id ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.buttonText}>
                          Отправить
                        </Text>
                      )}
                    </Pressable>
                  )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 20,
  },
  back: {
    color: C.red,
    fontSize: 15,
    marginBottom: 24,
    fontWeight: '600',
  },
  title: {
    color: C.white,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: C.muted,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: C.red,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '800',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: '#404046',
  },
  tabText: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabText: {
    color: C.white,
  },
  scroll: {
    flex: 1,
  },
  list: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: C.card,
    padding: 17,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  route: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  date: {
    color: C.muted,
    fontSize: 12,
    marginTop: 10,
  },
  statusRow: {
    marginTop: 12,
  },
  status: {
    color: '#F1C47B',
    fontSize: 13,
    fontWeight: '700',
  },
  completed: {
    color: C.green,
  },
  sendButton: {
    backgroundColor: C.red,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  muted: {
    color: C.muted,
    fontSize: 14,
  },
  error: {
    color: '#FF8B8B',
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    color: C.red,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  empty: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 20,
    textAlign: 'center',
  },
});
