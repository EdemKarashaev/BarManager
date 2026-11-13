import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Добавьте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_KEY в .env и перезапустите Expo. Используйте публичный ключ проекта, не service_role.');
}
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: canPersist,
    persistSession: canPersist,
    detectSessionInUrl: false,
    lock: processLock,
  },
});
