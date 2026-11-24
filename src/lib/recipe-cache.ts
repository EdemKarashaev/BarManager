import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Recipe, RecipeStep } from './recipe-model';

export type RecipeSnapshot = {
  version: 1;
  userId: string;
  roleId: number;
  savedAt: number;
  recipes: Recipe[];
  steps: Record<string, RecipeStep[]>;
};

const PREFIX = 'bm:recipes:v1:';
const DB_NAME = 'bar-manager-recipes';
const STORE = 'snapshots';

function key(userId: string, roleId: number) {
  return `${PREFIX}${userId}:${roleId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function webRead(k: string): Promise<string | null> {
  const db = await openDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .get(k);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function webWrite(k: string, value: string | null) {
  const db = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);

      if (value === null) store.delete(k);
      else store.put(value, k);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readRecipeCache(
  userId: string,
  roleId: number,
): Promise<RecipeSnapshot | null> {
  try {
    const k = key(userId, roleId);

    const raw = Platform.OS === 'web'
      ? await webRead(k)
      : await AsyncStorage.getItem(k);

    if (!raw) return null;

    const data = JSON.parse(raw) as RecipeSnapshot;

    if (
      data.version !== 1 ||
      data.userId !== userId ||
      data.roleId !== roleId ||
      !Array.isArray(data.recipes) ||
      !data.steps
    ) return null;

    return data;
  } catch {
    return null;
  }
}

export async function writeRecipeCache(
  snapshot: RecipeSnapshot,
): Promise<void> {
  const k = key(snapshot.userId, snapshot.roleId);
  const value = JSON.stringify(snapshot);

  if (Platform.OS === 'web') {
    await webWrite(k, value);
  } else {
    await AsyncStorage.setItem(k, value);
  }
}

export async function clearRecipeCache(
  userId: string,
): Promise<void> {
  for (const roleId of [1, 2, 3]) {
    const k = key(userId, roleId);

    if (Platform.OS === 'web') {
      await webWrite(k, null);
    } else {
      await AsyncStorage.removeItem(k);
    }
  }
}
