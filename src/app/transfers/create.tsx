
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Restaurant = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
  unit: string;
  category: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
};

const C = {
  bg: '#151518',
  card: '#242428',
  red: '#CC0014',
  white: '#FFFFFF',
  muted: '#AAAAAA',
  green: '#79D5A4',
};

export default function CreateTransferScreen() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [step, setStep] = useState<'restaurant' | 'products'>('restaurant');

  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [locationsResult, productsResult] = await Promise.all([
          supabase.rpc('get_inventory_destinations'),
          supabase
            .from('inventory_nomenclature')
            .select('id,code,name,unit,category')
            .eq('is_active', true)
            .order('name')
            .limit(1000),
        ]);

        if (!active) return;

        if (locationsResult.error) {
          throw locationsResult.error;
        }

        if (productsResult.error) {
          throw productsResult.error;
        }

        setRestaurants(locationsResult.data ?? []);
        setProducts(productsResult.data ?? []);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');

    if (!query) return [];

    return products
      .filter((product) => {
        const text = `${product.name} ${product.code}`
          .toLocaleLowerCase('ru')
          .replace(/ё/g, 'е');

        return text.includes(query);
      })
      .slice(0, 40);
  }, [products, search]);

  const restaurant = restaurants.find(
    (item) => item.id === restaurantId
  );

  function addProduct() {
    if (!selectedProduct) return;

    const normalized = quantity.trim().replace(',', '.');
    const value = Number(normalized);

    if (
      !/^\d+([.,]\d{1,3})?$/.test(quantity.trim()) ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      Alert.alert(
        'Некорректное количество',
        'Введите число больше нуля, максимум 3 знака после запятой.'
      );
      return;
    }

    setCart((previous) => {
      const existing = previous.find(
        (item) => item.product.id === selectedProduct.id
      );

      if (existing) {
        return previous.map((item) =>
          item.product.id === selectedProduct.id
            ? { ...item, quantity: value }
            : item
        );
      }

      return [...previous, { product: selectedProduct, quantity: value }];
    });

    setSelectedProduct(null);
    setQuantity('');
    setSearch('');
  }

  async function sendTransfer() {
    if (!restaurantId || cart.length === 0 || sending) return;

    setSending(true);
    let draftId: string | null = null;

    try {
      const created = await supabase.rpc('create_inventory_transfer', {
        p_to_location_id: restaurantId,
      });

      if (created.error) throw created.error;
      if (!created.data) throw new Error('Не получен ID перемещения');

      draftId = created.data as string;

      for (const item of cart) {
        const result = await supabase.rpc('add_inventory_transfer_item', {
          p_transfer_id: draftId,
          p_nomenclature_id: item.product.id,
          p_quantity: item.quantity,
        });

        if (result.error) throw result.error;
      }

      const sent = await supabase.rpc('send_inventory_transfer', {
        p_transfer_id: draftId,
      });

      if (sent.error) throw sent.error;

      Alert.alert(
        'Перемещение отправлено',
        `Документ отправлен в ресторан «${restaurant?.name}».`,
        [{ text: 'Готово', onPress: () => router.replace('/transfers') }]
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      Alert.alert(
        'Не удалось завершить отправку',
        draftId
          ? `В базе мог сохраниться черновик ${draftId}. Не отправляйте документ повторно, пока не проверим его.\n\n${message}`
          : message
      );
    } finally {
      setSending(false);
    }
  }

  function confirmSend() {
    if (!restaurantId || cart.length === 0 || sending) return;

    Alert.alert(
      'Подтвердить отправку?',
      `Ресторан: ${restaurant?.name}\nПозиций: ${cart.length}`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Отправить', onPress: () => void sendTransfer() },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.red} size="large" />
        <Text style={styles.muted}>Загружаем данные…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </Pressable>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Pressable
        onPress={() => {
          if (step === 'products') {
            setStep('restaurant');
          } else {
            router.back();
          }
        }}
      >
        <Text style={styles.back}>← Назад</Text>
      </Pressable>

      <Text style={styles.title}>Новое перемещение</Text>

      {step === 'restaurant' ? (
        <>
          <Text style={styles.subtitle}>
            Выберите ресторан-получатель
          </Text>

          <ScrollView style={styles.scroll}>
            {restaurants.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setRestaurantId(item.id)}
                style={[
                  styles.card,
                  restaurantId === item.id && styles.selectedCard,
                ]}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.check}>
                  {restaurantId === item.id ? '✓' : '○'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            disabled={!restaurantId}
            style={[
              styles.button,
              !restaurantId && styles.disabled,
            ]}
            onPress={() => setStep('products')}
          >
            <Text style={styles.buttonText}>Продолжить</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>
            Получатель: {restaurant?.name}
          </Text>

          <Text style={styles.count}>
            Номенклатура: {products.length} позиций
          </Text>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>ПОИСК ТОВАРА</Text>

            <TextInput
              style={styles.input}
              placeholder="Название или код"
              placeholderTextColor="#777777"
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                setSelectedProduct(null);
              }}
            />

            {filteredProducts.map((product) => (
              <Pressable
                key={product.id}
                style={[
                  styles.product,
                  selectedProduct?.id === product.id &&
                    styles.selectedCard,
                ]}
                onPress={() => {
                  setSelectedProduct(product);
                  setQuantity(
                    cart.find((item) => item.product.id === product.id)
                      ?.quantity.toString() ?? ''
                  );
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productInfo}>
                    {product.code} · {product.unit}
                  </Text>
                </View>
                <Text style={styles.check}>
                  {selectedProduct?.id === product.id ? '✓' : '+'}
                </Text>
              </Pressable>
            ))}

            {search.trim() && filteredProducts.length === 0 && (
              <Text style={styles.muted}>Ничего не найдено</Text>
            )}

            {selectedProduct && (
              <View style={styles.editor}>
                <Text style={styles.cardTitle}>
                  {selectedProduct.name}
                </Text>

                <Text style={styles.muted}>
                  Количество ({selectedProduct.unit})
                </Text>

                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="Например, 1,250"
                  placeholderTextColor="#777777"
                  value={quantity}
                  onChangeText={setQuantity}
                />

                <Pressable
                  style={styles.button}
                  onPress={addProduct}
                >
                  <Text style={styles.buttonText}>
                    + Добавить товар
                  </Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Добавленные товары ({cart.length})
            </Text>

            {cart.length === 0 ? (
              <Text style={styles.muted}>
                Пока нет добавленных товаров
              </Text>
            ) : (
              cart.map((item) => (
                <View key={item.product.id} style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>
                      {item.product.name}
                    </Text>
                    <Text style={styles.productInfo}>
                      {item.quantity} {item.product.unit}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      setCart((previous) =>
                        previous.filter(
                          (row) => row.product.id !== item.product.id
                        )
                      )
                    }
                  >
                    <Text style={styles.remove}>Удалить</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>

          <Pressable
            disabled={cart.length === 0 || sending}
            style={[
              styles.button,
              (cart.length === 0 || sending) && styles.disabled,
            ]}
            onPress={confirmSend}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                Отправить перемещение · {cart.length}
              </Text>
            )}
          </Pressable>
        </>
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
  center: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scroll: {
    flex: 1,
    marginTop: 14,
  },
  back: {
    color: C.red,
    fontSize: 15,
    marginBottom: 24,
    fontWeight: '600',
  },
  title: {
    color: C.white,
    fontSize: 27,
    fontWeight: '800',
  },
  subtitle: {
    color: C.muted,
    fontSize: 14,
    marginTop: 8,
  },
  count: {
    color: C.green,
    fontSize: 13,
    marginTop: 10,
  },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: C.card,
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCard: {
    borderWidth: 1.5,
    borderColor: C.red,
  },
  cardTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
  },
  check: {
    color: C.red,
    fontSize: 22,
    marginLeft: 12,
  },
  input: {
    backgroundColor: C.card,
    color: C.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  product: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productName: {
    color: C.white,
    fontSize: 14,
    fontWeight: '600',
  },
  productInfo: {
    color: C.muted,
    fontSize: 12,
    marginTop: 5,
  },
  editor: {
    backgroundColor: '#303035',
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    gap: 8,
  },
  sectionTitle: {
    color: C.white,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 28,
    marginBottom: 14,
  },
  cartItem: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  remove: {
    color: '#FF8B8B',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 10,
  },
  button: {
    backgroundColor: C.red,
    borderRadius: 12,
    padding: 17,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  buttonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.4,
  },
  muted: {
    color: C.muted,
    fontSize: 14,
    marginTop: 8,
  },
  error: {
    color: '#FF8B8B',
    fontSize: 14,
    marginTop: 20,
  },
});
