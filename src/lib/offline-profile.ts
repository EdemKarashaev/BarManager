import AsyncStorage from '@react-native-async-storage/async-storage';

export type OfflineStaff = {
  roleId: number;
  roleName: string;
  isAdmin: boolean;
};

const PREFIX = 'bm:offline-profile:v1:';
const MAX_AGE = 72 * 60 * 60 * 1000;

export async function saveOfflineProfile(
  userId: string,
  staff: OfflineStaff,
) {
  await AsyncStorage.setItem(
    PREFIX + userId,
    JSON.stringify({
      userId,
      staff,
      savedAt: Date.now(),
    }),
  );
}

export async function readOfflineProfile(
  userId: string,
): Promise<OfflineStaff | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + userId);
    if (!raw) return null;

    const data = JSON.parse(raw);
    const age = Date.now() - data.savedAt;

    if (
      data.userId !== userId ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > MAX_AGE ||
      ![1, 2, 3].includes(data.staff?.roleId)
    ) return null;

    return {
      roleId: data.staff.roleId,
      roleName: data.staff.roleName,
      isAdmin: false,
    };
  } catch {
    return null;
  }
}

export async function clearOfflineProfile(userId: string) {
  await AsyncStorage.removeItem(PREFIX + userId);
}
