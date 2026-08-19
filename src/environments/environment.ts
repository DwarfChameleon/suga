// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

const resolveBackendBaseUrl = (): string => {
  const renderBackendBase = 'https://suga-server.onrender.com';

  if (typeof window === 'undefined') {
    return renderBackendBase;
  }

  const { protocol, hostname, port } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isNativeApp = !!(window as any)?.Capacitor?.isNativePlatform?.();

  // Native app: always use Render backend. Fallback to localhost is handled by the interceptor.
  if (isNativeApp) {
    return renderBackendBase;
  }

  // Browser localhost frontend -> use the live backend first during development.
  if (isLocalHost) {
    return renderBackendBase;
  }

  // Forwarded frontend URL like "...-8100.uks1.devtunnels.ms" -> "...-5000.uks1.devtunnels.ms".
  if (hostname.includes('.devtunnels.ms')) {
    const backendHost = hostname.replace(/-8100(\.)/i, '-5000$1');
    return `${protocol}//${backendHost}`;
  }

  // Direct backend origin (rare case) falls back to same host:5000 when possible.
  if (port === '5000') {
    return `${protocol}//${hostname}:5000`;
  }

  return renderBackendBase;
};

const backendBaseUrl = resolveBackendBaseUrl();

export const environment = {
  production: false,
  apiUrl: `${backendBaseUrl}/api`,
  baseUrl: backendBaseUrl,
  uploadUrl: `${backendBaseUrl}/uploads`,
  socketUrl: backendBaseUrl,
  googleClientId: '580684284008-3hchjufr7hhu18agbqis8dghcd1m1p50.apps.googleusercontent.com'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
