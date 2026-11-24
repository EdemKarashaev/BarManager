// Web/iOS fallback; native Android implementation is resolved by Metro.

export async function checkUpdate(): Promise<string | null> {
  return null;
}

export async function installUpdate(): Promise<void> {
  throw new Error('Недоступно на этой платформе');
}

export async function registerPush(_userId: string): Promise<string> {
  return 'Недоступно';
}

export async function unregisterPush(): Promise<void> {}

export function getUpdateDiagnostics() {
  return {
    enabled: false,
    runtimeVersion: 'Недоступно',
    channel: 'Недоступно',
    appVersion: 'Недоступно',
    updateId: 'Недоступно',
    embedded: false,
  };
}