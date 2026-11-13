
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

type StorageNorm = {
  id: number;
  product_name: string;
  category: string | null;
  temperature: string | null;
  shelf_life: string | null;
  storage_conditions: string | null;
  notes: string | null;
};

export default function StorageNormsScreen() {
  const [norms, setNorms] = useState<StorageNorm[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNorms();
  }, []);

  async function loadNorms() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('storage_norms')
      .select('*')
      .order('product_name');

    if (error) {
      setError(error.message);
    } else {
      setNorms(data ?? []);
    }

    setLoading(false);
  }

  const categories = [
    'Все',
    ...Array.from(
      new Set(norms.map(n => n.category).filter((x): x is string => !!x))
    ),
  ];

  const filtered = norms.filter(n => {
    const matchesSearch = n.product_name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesCategory =
      category === 'Все' || n.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Нормы хранения</Text>

      <TextInput
        style={styles.search}
        placeholder="Поиск продукта..."
        placeholderTextColor="#858B95"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.categories}>
        {categories.map(item => (
          <Pressable
            key={item}
            onPress={() => setCategory(item)}
            style={[
              styles.category,
              category === item && styles.activeCategory,
            ]}
          >
            <Text style={styles.categoryText}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.header}>
        <Text style={[styles.name, styles.headerText]}>ПРОДУКТ</Text>
        <Text style={[styles.temp, styles.headerText]}>ТЕМП.</Text>
        <Text style={[styles.term, styles.headerText]}>СРОК</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#8DD5A7" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          ListEmptyComponent={
            <Text style={styles.empty}>Ничего не найдено</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                setExpandedId(
                  expandedId === item.id ? null : item.id
                )
              }
              style={styles.item}
            >
              <View style={styles.row}>
                <Text style={styles.name}>{item.product_name}</Text>
                <Text style={styles.temp}>{item.temperature || '—'}</Text>
                <Text style={styles.term}>{item.shelf_life || '—'}</Text>
              </View>

              {expandedId === item.id && (
                <View style={styles.details}>
                  <Text style={styles.detailText}>
                    Хранение: {item.storage_conditions || 'Не указано'}
                  </Text>
                  {!!item.notes && (
                    <Text style={styles.detailText}>
                      Примечание: {item.notes}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171B20',
    padding: 16,
    paddingTop: 50,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 18,
  },
  search: {
    backgroundColor: '#292E35',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  category: {
    backgroundColor: '#292E35',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  activeCategory: {
    backgroundColor: '#426A55',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#444',
  },
  headerText: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '600',
  },
  item: {
    borderBottomWidth: 1,
    borderColor: '#30363D',
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingRight: 8,
  },
  temp: {
    width: 78,
    color: '#C7CDD5',
    fontSize: 12,
  },
  term: {
    width: 62,
    color: '#8DD5A7',
    fontSize: 12,
    textAlign: 'right',
  },
  details: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#292E35',
  },
  detailText: {
    color: '#D1D5DB',
    fontSize: 12,
    marginBottom: 4,
  },
  error: {
    color: '#F87171',
    marginTop: 20,
  },
  empty: {
    color: '#A1A1AA',
    marginTop: 20,
    textAlign: 'center',
  },
});
