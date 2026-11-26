const PROXY_URL =
  'https://functions.yandexcloud.net/d4evppkcg52ligkqd6dn';

type Route = 'direct' | 'proxy';

let activeRoute: Route | null = null;
let checkedAt = 0;
let pendingCheck: Promise<Route> | null = null;

const ROUTE_TTL = 60_000;
const nativeFetch = globalThis.fetch.bind(globalThis);

async function healthCheck(
  url: string,
  key: string,
  timeout: number
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    const response = await nativeFetch(url, {
      method: 'GET',
      headers: { apikey: key },
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function chooseRoute(
  baseUrl: string,
  key: string
): Promise<Route> {
  if (
    activeRoute &&
    Date.now() - checkedAt < ROUTE_TTL
  ) {
    return activeRoute;
  }

  if (pendingCheck) return pendingCheck;

  pendingCheck = (async (): Promise<Route> => {
    const direct = await healthCheck(
      baseUrl + '/auth/v1/health',
      key,
      2500
    );

    if (direct) {
      activeRoute = 'direct';
    } else {
      const proxy = await healthCheck(
        PROXY_URL + '?path=%2Fauth%2Fv1%2Fhealth',
        key,
        6000
      );

      if (!proxy) {
        activeRoute = null;
        throw new Error(
          'Нет подключения к серверу Bar Manager'
        );
      }

      activeRoute = 'proxy';
    }

    checkedAt = Date.now();

    console.info('[BarManager] Network:', activeRoute);

    return activeRoute;
  })();

  try {
    return await pendingCheck;
  } finally {
    pendingCheck = null;
  }
}

export function createSupabaseFetch(
  baseUrl: string,
  key: string
): typeof fetch {
  return async (input, init) => {
    const originalUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const url = new URL(originalUrl);

    if (url.origin !== new URL(baseUrl).origin) {
      return nativeFetch(input, init);
    }

    if (!/^\/(auth|rest)\/v1(?:\/|$)/.test(url.pathname)) {
      return nativeFetch(input, init);
    }

    const route = await chooseRoute(baseUrl, key);

    try {
      if (route === 'direct') {
        return await nativeFetch(input, init);
      }

      const proxyUrl = new URL(PROXY_URL);
      proxyUrl.searchParams.set('path', url.pathname);

      url.searchParams.forEach((value, name) => {
        proxyUrl.searchParams.append(name, value);
      });

      const request = new Request(input, init);
      const headers = new Headers(request.headers);
      const authorization = headers.get('authorization');

      if (authorization) {
        headers.set('x-bm-authorization', authorization);
        headers.delete('authorization');
      }

      const method = request.method.toUpperCase();

      return await nativeFetch(proxyUrl.toString(), {
        method,
        headers,
        body:
          method === 'GET' || method === 'HEAD'
            ? undefined
            : await request.text(),
        signal: request.signal,
      });
    } catch (error) {
      activeRoute = null;
      checkedAt = 0;

      // Не повторяем запрос автоматически:
      // операция записи могла уже выполниться.
      throw error;
    }
  };
}

export function getSupabaseRoute() {
  return activeRoute ?? 'checking';
}
