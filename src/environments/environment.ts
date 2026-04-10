// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

const resolveBackendBaseUrl = (): string => {
  const localhostBase = 'http://localhost:5000';
  const renderBackendBase = 'https://suga-server.onrender.com';

  if (typeof window === 'undefined') {
    return localhostBase;
  }

  const { protocol, hostname, port } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isNativeApp = !!(window as any)?.Capacitor?.isNativePlatform?.();

  // Native app webview uses localhost origin, so point it to the hosted backend.
  if (isLocalHost && isNativeApp) {
    return renderBackendBase;
  }

  // Browser localhost frontend -> localhost backend.
  if (isLocalHost) {
    return localhostBase;
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
  googleClientId: '442106181123-24duo2db3chep7m4amp2dghrtlonv5mo.apps.googleusercontent.com'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
