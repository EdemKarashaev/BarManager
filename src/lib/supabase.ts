import { createSupabaseFetch } from './supabase-network';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { Platform } from 'react-native';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://cdiunbffdbyzmmthehic.supabase.co";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || "sb_publishable_tD1mIIXhCXAAx32nZz7ZYw_E4pdHuug";
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Добавьте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_KEY в .env и перезапустите Expo. Используйте публичный ключ проекта, не service_role.');
}
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: createSupabaseFetch(supabaseUrl, supabaseKey),
  },
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: canPersist,
    persistSession: canPersist,
    detectSessionInUrl: false,
    lock: processLock,
  },
});
