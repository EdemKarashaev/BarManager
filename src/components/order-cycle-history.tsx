import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
} from 'react-native';
import { useAppTheme } from '@/providers/theme';
import { OrderCyclesList } from './order-cycles-list';
import {
  fetchCycleDashboard,
  fetchMyCycleOrder,
  orderError,
  orderStatus,
  type Order,
  type OrderCycle,
  type Location,
} from '@/lib/orders-api';

type Props = {
  isAdmin: boolean;
  locations: Location[];
};

export function OrderCycleHistory({
  isAdmin,
  locations,
}: Props) {
  const { colors } = useAppTheme();
  const [cycle, setCycle] = useState<OrderCycle | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setOrders([]);
    setError('');

    if (!cycle) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const request = isAdmin
      ? fetchCycleDashboard(cycle.id)
      : fetchMyCycleOrder(cycle.id).then(result =>
          result
            ? [{ ...result.order, items: result.items }]
            : []
        );

    request
      .then(data => {
        if (active) setOrders(data);
      })
      .catch(e => {
        if (active) setError(orderError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cycle, isAdmin]);

  return (
    <View style={{ flex: 1, padding: 12, gap: 8 }}>
      <OrderCyclesList
        selectedId={cycle?.id ?? null}
        onSelect={setCycle}
      />

      <Text style={{ color: colors.muted }}>
        Просмотр заказов без редактирования
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : error ? (
        <Text style={{ color: colors.error }}>{error}</Text>
      ) : (
        <FlatList
          data={orders.flatMap(order =>
            (order.items ?? []).map(item => ({
              order,
              item,
            }))
          )}
          keyExtractor={({ order, item }) =>
            `${order.id}:${item.product_id}`
          }
          ListEmptyComponent={
            <Text style={{ color: colors.muted }}>
              {cycle
                ? 'Нет позиций в заказах'
                : 'Выберите период'}
            </Text>
          }
          renderItem={({ item: { order, item } }) => (
            <View style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              marginBottom: 6,
              gap: 5,
            }}>
              {isAdmin && (
                <Text style={{ color: colors.accent }}>
                  {locations.find(l =>
                    l.id === order.location_id
                  )?.name ?? 'Ресторан'}
                </Text>
              )}

              <Text style={{
                color: colors.text,
                fontWeight: '600',
              }}>
                {item.product_name_snapshot}
              </Text>

              <Text style={{ color: colors.muted }}>
                {item.supplier_name_snapshot ?? '—'}
              </Text>

              <Text style={{ color: colors.text }}>
                {item.quantity} {item.unit_snapshot ?? ''}
              </Text>

              <Text style={{ color: colors.muted }}>
                {orderStatus[order.status] ?? order.status}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
