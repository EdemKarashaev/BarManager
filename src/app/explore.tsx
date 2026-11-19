import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Назад</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>BAR MANAGER</Text>

        <Text style={styles.subtitle}>
          Дополнительные возможности
        </Text>

        <Text style={styles.description}>
          Здесь появятся новые разделы приложения.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#151518',
    padding: 20,
  },
  backButton: {
    paddingVertical: 12,
  },
  backText: {
    color: '#C7A56B',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: '#C7A56B',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 3,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
  },
});