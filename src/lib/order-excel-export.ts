import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type ExportSummaryRow = {
  name: string;
  supplier: string;
  supplierId: string | null;
  price: string | null;
  quantities: Record<string, number>;
  total: number;
  amount: number;
};
export type ExportLocation = { id: string; name: string };

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 80);
const round3 = (n: number) => Number(n.toFixed(3));

function workbookBase64(rows: ExportSummaryRow[], locations: ExportLocation[], supplierName: string, week: string): string {
  const columns = ['Товар', 'Цена, ₽', ...locations.map(l => l.name), 'Всего', 'Сумма, ₽'];
  const data: (string | number)[][] = [
    [`Поставщик: ${supplierName}`],
    [`Неделя: ${week}`],
    [],
    columns,
    ...rows.map(r => [
      r.name,
      r.price === null ? '' : Number(r.price),
      ...locations.map(l => round3(r.quantities[l.id] ?? 0)),
      round3(r.total),
      Number(r.amount.toFixed(2)),
    ]),
    ['ИТОГО', '', ...locations.map(l => round3(rows.reduce((sum, r) => sum + (r.quantities[l.id] ?? 0), 0))),
      round3(rows.reduce((sum, r) => sum + r.total, 0)),
      Number(rows.reduce((sum, r) => sum + r.amount, 0).toFixed(2))],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 48 }, { wch: 16 }, ...locations.map(() => ({ wch: 18 })), { wch: 14 }, { wch: 18 }];
  sheet['!freeze'] = { xSplit: 1, ySplit: 4 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Заказ');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
}

const EXPORT_FOLDER_KEY = 'bm:orders:export-folder';

async function saveAndroidFile(
  base64: string,
  filename: string,
  mimeType: string
) {
  const saf = FileSystem.StorageAccessFramework;

  let directoryUri = await AsyncStorage
    .getItem(EXPORT_FOLDER_KEY)
    .catch(() => null);

  if (directoryUri) {
    try {
      await saf.readDirectoryAsync(directoryUri);
    } catch {
      directoryUri = null;
      await AsyncStorage
        .removeItem(EXPORT_FOLDER_KEY)
        .catch(() => {});
    }
  }

  if (!directoryUri) {
    const permission =
      await saf.requestDirectoryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Скачивание отменено',
        'Папка для сохранения не выбрана.'
      );
      return;
    }

    directoryUri = permission.directoryUri;

    await AsyncStorage
      .setItem(EXPORT_FOLDER_KEY, directoryUri)
      .catch(() => {});
  }

  const nameWithoutExtension =
    filename.replace(/\\.[^.]+$/, '');

  const fileUri = await saf.createFileAsync(
    directoryUri,
    nameWithoutExtension,
    mimeType
  );

  try {
    await FileSystem.writeAsStringAsync(
      fileUri,
      base64,
      { encoding: FileSystem.EncodingType.Base64 }
    );
  } catch (error) {
    await FileSystem.deleteAsync(
      fileUri,
      { idempotent: true }
    ).catch(() => {});

    throw error;
  }

  Alert.alert(
    'Файл сохранён',
    filename + '\\n\\nФайл находится в выбранной папке.'
  );
}

async function shareBase64(
  base64: string,
  filename: string,
  mimeType: string
) {
  if (Platform.OS === 'web') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);

    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    return;
  }

  if (Platform.OS === 'android') {
    await saveAndroidFile(base64, filename, mimeType);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      'Системное меню сохранения/отправки файлов недоступно на этом устройстве.'
    );
  }

  const root = FileSystem.cacheDirectory;

  if (!root) {
    throw new Error(
      'Не удалось получить временную папку устройства.'
    );
  }

  const uri = root + filename;

  await FileSystem.writeAsStringAsync(
    uri,
    base64,
    { encoding: FileSystem.EncodingType.Base64 }
  );

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: 'Сохранить или отправить заказ'
  });
}

export async function exportSupplierExcel(rows: ExportSummaryRow[], locations: ExportLocation[], supplierName: string, week: string) {
  if (!rows.length) throw new Error('У поставщика нет заказанных товаров.');
  await shareBase64(workbookBase64(rows, locations, supplierName, week),
    `Заказ_${safeFileName(supplierName)}_${week}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function exportAllSuppliersZip(rows: ExportSummaryRow[], locations: ExportLocation[], week: string) {
  const groups = new Map<string, { name: string; rows: ExportSummaryRow[] }>();
  for (const row of rows) {
    const id = row.supplierId ?? `unknown:${row.supplier}`;
    if (!groups.has(id)) groups.set(id, { name: row.supplier, rows: [] });
    groups.get(id)!.rows.push(row);
  }
  if (!groups.size) throw new Error('Нет заказанных товаров для выгрузки.');
  const zip = new JSZip();
  const used = new Set<string>();
  for (const [id, group] of groups) {
    let filename = `Заказ_${safeFileName(group.name)}_${week}.xlsx`;
    if (used.has(filename)) filename = `Заказ_${safeFileName(group.name)}_${safeFileName(id.slice(0, 8))}_${week}.xlsx`;
    used.add(filename);
    zip.file(filename, workbookBase64(group.rows, locations, group.name, week), { base64: true });
  }
  const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  await shareBase64(base64, `Заказы_поставщики_${week}.zip`, 'application/zip');
}
