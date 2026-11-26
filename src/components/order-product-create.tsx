import { useAppTheme } from '@/providers/theme';
import { useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  orderError,
  ordersRpc,
  type Catalog,
} from "@/lib/orders-api";
import { blockUpdates } from "@/lib/update-guard";
import { OButton, getThemeos } from "./order-ui";

type Props = {
  catalog: Catalog;
  setCatalog: (catalog: Catalog) => void;
  disabled: boolean;
};

export function OrderProductCreate({
  catalog,
  setCatalog,
  disabled,
}: Props) {
  const { mode: bmMode } = useAppTheme();
  const os = getThemeos(bmMode);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [price, setPrice] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);

  const categories = [...new Set(
    catalog.products
      .map((p) => p.category)
      .filter((c): c is string => !!c)
  )].sort((a, b) => a.localeCompare(b, "ru"));

  const inputStyle = {
    color: (bmMode === 'light' ? '#111111' : "#FFFFFF"),
    backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"),
    borderColor: (bmMode === 'light' ? '#DDDDDD' : "#505056"),
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  };

  function reset() {
    setName("");
    setCategory("");
    setSupplier("");
    setPrice("");
    setCategorySearch("");
    setSupplierSearch("");
    setError("");
  }

  async function createProduct() {
    if (lock.current || disabled) return;

    const normalizedPrice = price.trim().replace(",", ".");

    if (
      !name.trim() ||
      !category ||
      !supplier ||
      !/^\d+(\.\d{1,2})?$/.test(normalizedPrice) ||
      Number(normalizedPrice) > 9999999
    ) {
      setError("Заполните все поля и проверьте цену.");
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    const unblock = blockUpdates();

    try {
      await ordersRpc<string>("bm_orders_product_create", {
        p_name: name.trim(),
        p_category: category,
        p_supplier_id: supplier,
        p_price: Number(normalizedPrice),
      });

      setOpen(false);
      reset();
      setMessage("Товар добавлен в общий каталог.");

      try {
        setCatalog(
          await ordersRpc<Catalog>("bm_orders_catalog")
        );
      } catch {
        setMessage(
          "Товар создан. Обновите страницу для загрузки каталога."
        );
      }
    } catch (e) {
      setError(orderError(e));
    } finally {
      unblock();
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <OButton
        title="+ Добавить товар"
        disabled={disabled || busy}
        onPress={() => {
          reset();
          setMessage("");
          setOpen(true);
        }}
      />

      {!!message && (
        <Text style={os.success}>{message}</Text>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.75)",
          padding: 16,
        }}>
          <View style={{
            width: "100%",
            maxWidth: 500,
            maxHeight: "90%",
            backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#202226"),
            borderRadius: 14,
            padding: 16,
          }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 12 }}
            >
              <Text style={{
                color: (bmMode === 'light' ? '#B00020' : "#C7A56B"),
                fontSize: 22,
                fontWeight: "700",
              }}>
                Новая позиция
              </Text>

              <Text style={os.muted}>Наименование</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={!busy}
                maxLength={250}
                placeholder="Название товара"
                placeholderTextColor={(bmMode === 'light' ? '#666666' : "#888")}
                style={inputStyle}
              />

              <Text style={os.muted}>Раздел</Text>
              <TextInput
                value={categorySearch}
                onChangeText={setCategorySearch}
                editable={!busy}
                placeholder="Поиск раздела"
                placeholderTextColor={(bmMode === 'light' ? '#666666' : "#888")}
                style={inputStyle}
              />

              <View style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
              }}>
                {categories.filter((c) =>
                  c.toLowerCase().includes(
                    categorySearch.toLowerCase()
                  )
                ).map((c) => (
                  <TouchableOpacity
                    key={c}
                    disabled={busy}
                    onPress={() => setCategory(c)}
                    style={{
                      padding: 10,
                      borderRadius: 7,
                      borderWidth: 1,
                      borderColor: category === c
                        ? "#C7A56B" : "#505056",
                      backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"),
                    }}
                  >
                    <Text style={{
                      color: category === c
                        ? "#C7A56B" : "#FFFFFF",
                    }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={os.muted}>
                Выбран раздел: {category || "Не выбран"}
              </Text>

              <Text style={os.muted}>Поставщик</Text>
              <TextInput
                value={supplierSearch}
                onChangeText={setSupplierSearch}
                editable={!busy}
                placeholder="Поиск поставщика"
                placeholderTextColor={(bmMode === 'light' ? '#666666' : "#888")}
                style={inputStyle}
              />

              <View style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
              }}>
                {catalog.suppliers.filter((s) =>
                  s.name.toLowerCase().includes(
                    supplierSearch.toLowerCase()
                  )
                ).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    disabled={busy}
                    onPress={() => setSupplier(s.id)}
                    style={{
                      padding: 10,
                      borderRadius: 7,
                      borderWidth: 1,
                      borderColor: supplier === s.id
                        ? "#C7A56B" : "#505056",
                      backgroundColor: (bmMode === 'light' ? '#F5F5F5' : "#292b30"),
                    }}
                  >
                    <Text style={{
                      color: supplier === s.id
                        ? "#C7A56B" : "#FFFFFF",
                    }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={os.muted}>
                Выбран поставщик: {
                  catalog.suppliers.find(
                    (s) => s.id === supplier
                  )?.name ?? "Не выбран"
                }
              </Text>

              <Text style={os.muted}>Закупочная цена, ₽</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                editable={!busy}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={(bmMode === 'light' ? '#666666' : "#888")}
                style={inputStyle}
              />

              <Text style={os.success}>
                Доступно всем ресторанам
              </Text>

              {!!error && (
                <Text style={os.error}>{error}</Text>
              )}

              <OButton
                title={busy ? "Добавляем…" : "Добавить товар"}
                disabled={
                  busy || disabled ||
                  !name.trim() || !category ||
                  !supplier || !price.trim()
                }
                onPress={() => void createProduct()}
              />

              <OButton
                title="Отмена"
                disabled={busy}
                onPress={() => setOpen(false)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
