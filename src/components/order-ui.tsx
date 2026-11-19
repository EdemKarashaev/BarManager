import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
export const os = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#151518" },
  content: { padding: 18, gap: 12, paddingBottom: 36 },
  text: { color: "#F4F1ED", fontSize: 15 },
  muted: { color: "#B3B1BA", fontSize: 13 },
  title: { color: "#F4F1ED", fontSize: 25, fontWeight: "700" },
  heading: { color: "#F4F1ED", fontSize: 18, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "#222226",
    padding: 16,
    borderRadius: 14,
    gap: 10,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#59545B",
    borderRadius: 10,
    padding: 12,
    color: "#FFF",
    minHeight: 46,
    backgroundColor: "#1C1B20",
  },
  button: {
    backgroundColor: "#713F4A",
    padding: 13,
    borderRadius: 10,
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  chip: {
    backgroundColor: "#29272E",
    borderWidth: 1,
    borderColor: "#59545B",
    borderRadius: 10,
    padding: 12,
  },
  selected: { borderColor: "#EE9EA4", backgroundColor: "#4A303B" },
  error: { color: "#FFA6A6", fontSize: 14 },
  success: { color: "#9CE1AD", fontSize: 14 },
  footer: {
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderColor: "#47414B",
    backgroundColor: "#1B191F",
  },
  qty: { width: 95, textAlign: "center" },
  cell: {
    width: 92,
    padding: 10,
    color: "#eee",
    borderBottomWidth: 1,
    borderBottomColor: "#3D3841",
  },
  nameCell: { width: 220 },
  line: { height: 1, backgroundColor: "#444" },
});
export function OButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[os.button, disabled && os.disabled]}
    >
      <Text style={os.text}>{title}</Text>
    </Pressable>
  );
}
export function Choice({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
    >
      {options.map((o) => (
        <Pressable
          key={o.id}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.id, disabled }}
          disabled={disabled}
          onPress={() => onChange(o.id)}
          style={[os.chip, value === o.id && os.selected]}
        >
          <Text style={os.text}>{o.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export type Filters = {
  supplierId: string;
  category: string;
  insufficientOnly: boolean;
  minPrice: string;
  maxPrice: string;
  sort: "price_asc" | "price_desc" | undefined;
  query: string;
};
export const emptyFilters: Filters = {
  supplierId: "",
  category: "",
  insufficientOnly: false,
  minPrice: "",
  maxPrice: "",
  sort: undefined,
  query: "",
};
export function OrderFilters({
  filters: f,
  onChange: set,
  suppliers,
  categories,
  showShortage = true,
}: {
  filters: Filters;
  onChange: (v: Filters) => void;
  suppliers: { id: string; name: string }[];
  categories: string[];
  showShortage?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <TextInput
        accessibilityLabel="Поиск товара"
        placeholder="Название товара"
        placeholderTextColor="#aaa"
        value={f.query}
        onChangeText={(query) => set({ ...f, query })}
        style={os.input}
      />
      <Choice
        value={f.supplierId}
        options={[{ id: "", name: "Все поставщики" }, ...suppliers]}
        onChange={(supplierId) => set({ ...f, supplierId })}
      />
      <Choice
        value={f.category}
        options={[
          { id: "", name: "Все разделы" },
          ...categories.map((name) => ({ id: name, name })),
        ]}
        onChange={(category) => set({ ...f, category })}
      />
      <View style={os.row}>
        {showShortage && (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: f.insufficientOnly }}
            onPress={() => set({ ...f, insufficientOnly: !f.insufficientOnly })}
            style={[os.chip, f.insufficientOnly && os.selected]}
          >
            <Text style={os.text}>Только недобор</Text>
          </Pressable>
        )}
        <TextInput
          accessibilityLabel="Цена от"
          placeholder="Цена от"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
          maxLength={13}
          value={f.minPrice}
          onChangeText={(minPrice) => set({ ...f, minPrice })}
          style={[os.input, { width: 110 }]}
        />
        <TextInput
          accessibilityLabel="Цена до"
          placeholder="Цена до"
          placeholderTextColor="#aaa"
          keyboardType="decimal-pad"
          maxLength={13}
          value={f.maxPrice}
          onChangeText={(maxPrice) => set({ ...f, maxPrice })}
          style={[os.input, { width: 110 }]}
        />
      </View>
      <Choice
        value={f.sort || ""}
        options={[
          { id: "", name: "По списку" },
          { id: "price_asc", name: "Цена ↑" },
          { id: "price_desc", name: "Цена ↓" },
        ]}
        onChange={(sort) =>
          set({ ...f, sort: (sort as Filters["sort"]) || undefined })
        }
      />
    </View>
  );
}
