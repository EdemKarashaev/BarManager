
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Location = { id: string; name: string };
type Supplier = { id: string; name: string };
type Order = {
  id: string;
  location_id: string;
  week_start: string;
  status: string;
};
type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  supplier_id_snapshot: string | null;
};

type Product = {
  id: string;
  name: string;
  supplier_id: string | null;
  category: string | null;
};

type Cell = {
  key: string;
  itemId: string | null;
  productId: string;
  locationId: string;
  value: number;
  editable: boolean;
};

function formatQuantity(value: number) {
  return String(value);
}


function QuantityCell({
  cell,
  onSave,
}: {
  cell: Cell;
  onSave: (cell: Cell, quantity: number) => Promise<boolean>;
}) {
  const [text, setText] = useState(String(cell.value));
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!focused && !saving) {
      setText(String(cell.value));
    }
  }, [cell.value, focused, saving]);

  async function save() {
    if (savingRef.current || !cell.editable) return;

    const normalized = text.trim().replace(',', '.');
    const quantity = Number(normalized);

    if (
      normalized === '' ||
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      console.error('Некорректное количество');
      setText(String(cell.value));
      return;
    }

    if (quantity === cell.value) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const success = await onSave(cell, quantity);

      if (!success) {
        setText(String(cell.value));
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      setText(String(cell.value));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!cell.editable) {
    return (
      <View style={[styles.quantityCell, styles.disabledCell]}>
        <Text style={styles.muted}>—</Text>
      </View>
    );
  }

  return (
    <View style={styles.quantityCell}>
      <TextInput
        value={text}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => void save()}
        keyboardType="decimal-pad"
        returnKeyType="done"
        blurOnSubmit={false}
        selectTextOnFocus
        editable={!saving}
        style={[
          styles.quantityInput,
          focused && styles.focusedInput,
        ]}
      />
      {saving && (
        <ActivityIndicator
          size="small"
          color="#C7A56B"
          style={styles.savingIndicator}
        />
      )}
    </View>
  );
}


export default function AdminOrdersScreen() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);

  const [week, setWeek] = useState('');
  const [supplierId, setSupplierId] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [hideZero, setHideZero] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        locationsResult,
        suppliersResult,
        productsResult,
        ordersResult,
        itemsResult,
      ] = await Promise.all([
        supabase.from('order_locations').select('id,name'),
        supabase.from('order_suppliers').select('id,name'),
        supabase
          .from('order_products')
          .select('id,name,supplier_id,category'),
        supabase
          .from('weekly_orders')
          .select('id,location_id,week_start,status'),
        supabase
          .from('weekly_order_items')
          .select(
            'id,order_id,product_id,quantity,supplier_id_snapshot'
          ),
      ]);

      const results = [
        locationsResult,
        suppliersResult,
        productsResult,
        ordersResult,
        itemsResult,
      ];

      const failed = results.find((result) => result.error);

      if (failed?.error) throw failed.error;

      setLocations(locationsResult.data ?? []);
      setSuppliers(suppliersResult.data ?? []);
      setProducts(productsResult.data ?? []);
      setOrders(ordersResult.data ?? []);
      setItems(itemsResult.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weeks = useMemo(
    () =>
      [...new Set(orders.map((o) => o.week_start))]
        .filter(Boolean)
        .sort()
        .reverse(),
    [orders]
  );

  useEffect(() => {
    if (weeks.length && !weeks.includes(week)) {
      setWeek(weeks[0]);
    }
  }, [weeks, week]);

  const weekOrders = useMemo(
    () => orders.filter((o) => o.week_start === week),
    [orders, week]
  );

  const categories = useMemo(
  () =>
    [...new Set(
      products.map(p => p.category?.trim() || 'Без раздела')
    )].sort((a, b) => a.localeCompare(b, 'ru')),
  [products]
);

  const matrix = useMemo(() => {
    return products
      .map((product) => {
        const productItems = items.filter(
          (item) => item.product_id === product.id
        );

        const supplier =
          productItems.find(
            (item) =>
              weekOrders.some((o) => o.id === item.order_id) &&
              item.supplier_id_snapshot
          )?.supplier_id_snapshot ?? product.supplier_id;

        const cells: Cell[] = locations.map((location) => {
          const matchingOrders = weekOrders.filter(
            (order) => order.location_id === location.id
          );

          const matchingItems = productItems.filter((item) =>
            matchingOrders.some((o) => o.id === item.order_id)
          );

          return {
  key: `${product.id}:${location.id}`,
  itemId:
    matchingItems.length === 1
      ? matchingItems[0].id
      : null,
  productId: product.id,
  locationId: location.id,
  value: matchingItems.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  ),
  editable: matchingItems.length <= 1,
};
        });

        return {
          ...product,
          supplier,
          cells,
          total: cells.reduce((sum, cell) => sum + cell.value, 0),
        };
      })
      .filter(
        (product) =>
          (supplierId === 'all' || product.supplier === supplierId) &&
          (categoryFilter === 'all' ||
            (product.category?.trim() || 'Без раздела') === categoryFilter) &&
          (!hideZero || product.total !== 0)
      )
      .sort((a, b) => {
        const categoryA = a.category?.trim() || 'Без раздела';
        const categoryB = b.category?.trim() || 'Без раздела';
        const categoryComparison = categoryA.localeCompare(categoryB, 'ru');
        return categoryComparison || a.name.localeCompare(b.name, 'ru');
      });
  }, [
    products,
    items,
    locations,
    weekOrders,
    supplierId,
    categoryFilter,
    hideZero,
  ]);
  
  const groupedMatrix = useMemo(() => {
    const groups: { category: string; products: typeof matrix }[] = [];
    for (const product of matrix) {
      const category = product.category?.trim() || 'Без раздела';
      let group = groups.find((entry) => entry.category === category);
      if (!group) {
        group = { category, products: [] };
        groups.push(group);
      }
      group.products.push(product);
    }
    return groups;
  }, [matrix]);

async function addOrderItem(
  locationId: string,
  productId: string,
  quantity: number
) {
  const { error } = await supabase.rpc(
    'admin_set_order_quantity',
    {
      p_location_id: locationId,
      p_week_start: week,
      p_product_id: productId,
      p_quantity: quantity,
    }
  );

  if (error) {
    console.error('Ошибка добавления:', error);
    setErrorMessage(error.message);
    return false;
  }

  await load();
  return true;
}
  async function saveQuantity(itemId: string, quantity: number) {
    const original = items.find((item) => item.id === itemId);
    if (!original) return false;

    const { data, error: updateError } = await supabase
    
      .from('weekly_order_items')
      .update({ quantity })
      .eq('id', itemId)
      .eq('quantity', original.quantity)
      .select('id,quantity')
      .maybeSingle();
console.log('SUPABASE UPDATE:', {
  itemId,
  quantity,
  data,
  error: updateError,
});
    if (updateError || !data) {
      Alert.alert(
        'Не удалось сохранить',
        updateError?.message ??
          'Позиция уже изменилась или нет доступа. Обновите таблицу.'
      );
      return false;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );

    return true;
  }
async function saveCell(cell: Cell, quantity: number) {
  setErrorMessage('');

  if (cell.itemId) {
    const success = await saveQuantity(cell.itemId, quantity);

    if (!success) {
      setErrorMessage('Не удалось изменить количество.');
    }

    return success;
  }

  if (quantity === 0) return true;

  return addOrderItem(
    cell.locationId,
    cell.productId,
    quantity
  );
}
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C7A56B" />
        <Text style={styles.muted}>Загрузка заказов...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={() => void load()}>
          <Text style={styles.link}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const PageWrapper = Platform.OS === 'web' ? View : ScrollView;

  return (
    <PageWrapper
      style={[styles.container, Platform.OS === 'web' && styles.webPageScroll]}
      {...(Platform.OS !== 'web' ? {
        contentContainerStyle: styles.pageContent,
        keyboardShouldPersistTaps: 'handled' as const,
      } : {})}
    >
      <View style={Platform.OS === 'web' ? styles.pageContent : undefined}>
        {!!errorMessage && (
  <Text style={styles.error}>
    {errorMessage}
  </Text>
)}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Общий заказ</Text>
          <Text style={styles.subtitle}>
            Bar Manager · Панель администратора
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void load()}
        >
          <Text style={styles.refreshText}>Обновить</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Неделя заказа</Text>
      <ScrollView
        horizontal
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {weeks.map((w) => (
          <TouchableOpacity
            key={w}
            style={[
              styles.filterButton,
              week === w && styles.selectedFilter,
            ]}
            onPress={() => setWeek(w)}
          >
            <Text style={styles.filterText}>{w}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Поставщик</Text>
      <ScrollView
        horizontal
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            supplierId === 'all' && styles.selectedFilter,
          ]}
          onPress={() => setSupplierId('all')}
        >
          <Text style={styles.filterText}>Все</Text>
        </TouchableOpacity>

        {suppliers.map((supplier) => (
          <TouchableOpacity
            key={supplier.id}
            style={[
              styles.filterButton,
              supplierId === supplier.id &&
                styles.selectedFilter,
            ]}
            onPress={() => setSupplierId(supplier.id)}
          >
            <Text style={styles.filterText}>
              {supplier.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
<Text style={styles.label}>Раздел заказа</Text>

<ScrollView
  horizontal
  style={styles.filterScroll}
  contentContainerStyle={styles.filterRow}
>
  {['all', ...categories].map(category => (
    <TouchableOpacity
      key={category}
      style={[
        styles.filterButton,
        categoryFilter === category && styles.selectedFilter,
      ]}
      onPress={() => setCategoryFilter(category)}
    >
      <Text style={styles.filterText}>
        {category === 'all' ? 'Все разделы' : category}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setHideZero(!hideZero)}
      >
        <Text style={styles.toggle}>
          {hideZero ? '☑' : '☐'}
        </Text>
        <Text style={styles.toggleText}>
          Скрыть нулевые строки
        </Text>
      </TouchableOpacity>

      <ScrollView horizontal style={styles.tableScroll}>
        <View>
          <View style={styles.row}>
            <Text style={[styles.headerCell, styles.productCell]}>
              Наименование
            </Text>

            {locations.map((location) => (
              <Text
                key={location.id}
                style={styles.headerCell}
              >
                {location.name}
              </Text>
            ))}

            <Text style={styles.headerCell}>Итого</Text>
          </View>

          <View>
            {groupedMatrix.map((group) => (
              <View key={group.category}>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryTitle}>
                    {group.category.toUpperCase()} · {group.products.length} поз.
                  </Text>
                </View>
                {group.products.map((product) => (
                  <View key={product.id} style={styles.row}>
                    <Text style={[styles.cell, styles.productCell]}>
                      {product.name}
                    </Text>
                    {product.cells.map((cell) => (
                      <QuantityCell
                        key={cell.key}
                        cell={cell}
                        onSave={saveCell}
                      />
                    ))}
                    <Text style={[styles.cell, styles.total]}>
                      {product.total}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

          </View>
        </View>
      </ScrollView>

      <Text style={styles.footer}>
        Товаров в таблице: {matrix.length} ·
        Ресторанов: {locations.length}
      </Text>
      <Text style={styles.hint}>
        Нажми на количество, введи число и нажми Enter
        или перейди в другую ячейку.
        Прочерк означает, что редактируемая строка заказа
        отсутствует или есть несколько совпадений.
      </Text>
      </View>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151719',
  },
  webPageScroll: {
    overflowY: 'auto',
    overflowX: 'hidden',
    height: '100vh',
    flex: undefined,
  } as any,
  pageContent: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#151719',
    gap: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9CA3AF',
    marginTop: 6,
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#C7A56B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshText: {
    color: '#C7A56B',
    fontWeight: '600',
  },
  label: {
    color: '#9CA3AF',
    marginBottom: 8,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 18,
  },
  filterRow: {
    gap: 8,
    paddingRight: 16,
  },
  filterButton: {
    backgroundColor: '#25292D',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#33383E',
  },
  selectedFilter: {
    borderColor: '#C7A56B',
    backgroundColor: '#3A3327',
  },
  filterText: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  toggle: {
    color: '#C7A56B',
    fontSize: 22,
  },
  toggleText: {
    color: '#FFFFFF',
  },
  tableScroll: {
    flexGrow: 0,
  },
  categoryRow: {
    backgroundColor: '#292B2E',
    borderLeftWidth: 3,
    borderLeftColor: '#C7A56B',
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  categoryTitle: {
    color: '#C7A56B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  headerCell: {
    width: 125,
    padding: 12,
    color: '#C7A56B',
    fontWeight: '700',
    borderBottomWidth: 1,
    borderColor: '#4A4F55',
  },
  cell: {
    width: 125,
    padding: 12,
    color: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#303438',
  },
  productCell: {
    width: 250,
  },
  quantityCell: {
    width: 125,
    height: 52,
    padding: 5,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderColor: '#303438',
  },
  quantityInput: {
    height: 38,
    backgroundColor: '#24282C',
    borderWidth: 1,
    borderColor: '#343A40',
    borderRadius: 5,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 15,
    padding: 4,
  },
  focusedInput: {
    borderColor: '#C7A56B',
    backgroundColor: '#36342D',
  },
  disabledCell: {
    alignItems: 'center',
  },
  savingIndicator: {
    position: 'absolute',
    right: 4,
  },
  total: {
    color: '#C7A56B',
    fontWeight: '700',
  },
  footer: {
    color: '#9CA3AF',
    marginTop: 12,
  },
  hint: {
    color: '#6F7780',
    fontSize: 12,
    marginTop: 8,
  },
  muted: {
    color: '#6F7780',
  },
  error: {
    color: '#FF7777',
    padding: 20,
  },
  link: {
    color: '#C7A56B',
  },
});
