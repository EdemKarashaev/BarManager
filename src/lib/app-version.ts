import Constants from 'expo-constants';
import release from '../config/release.json';

export type AvailableUpdate = {
  id: string;
  version: string;
  changelog: string;
  releasedAt: string;
};

export const APP_VERSION = release.version;

export const APP_RELEASE_DATE = release.releasedAt;

export const APP_CHANGELOG = release.changelog;

export const APK_VERSION =
  Constants.nativeAppVersion ??
  Constants.expoConfig?.version ??
  'Неизвестно';
