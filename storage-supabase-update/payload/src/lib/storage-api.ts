import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorageNorm } from './storage-rules';
export async function fetchStorageNorms(client: SupabaseClient, signal: AbortSignal): Promise<StorageNorm[]> {
  const rows: StorageNorm[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    if (signal.aborted) throw new Error('Запрос отменён');
    const { data, error } = await client.from('storage_norms')
      .select('id,product_name,category,temperature,shelf_life,storage_conditions,notes')
      .order('id').range(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw error;
    const page = (data || []) as StorageNorm[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
export function storageError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/permission|denied|jwt|401|403/i.test(message)) return 'Не удалось получить доступ к нормам хранения. Войдите заново или обратитесь к администратору.';
  if (/fetch|network|timeout|abort|отмен/i.test(message)) return 'Не удалось связаться с сервером. Проверьте интернет и повторите попытку.';
  return 'Не удалось загрузить нормы хранения. Повторите попытку. Если ошибка сохраняется, проверьте таблицу storage_norms и права чтения.';
}
