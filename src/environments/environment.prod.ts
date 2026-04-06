const resolveBackendBaseUrl = (): string => {
  const localhostBase = 'http://localhost:5000';
  const fallbackTunnelBase = 'https://dclv5j4m-5000.uks1.devtunnels.ms';

  if (typeof window === 'undefined') {
    return fallbackTunnelBase;
  }

  const { protocol, hostname } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isNativeApp = !!(window as any)?.Capacitor?.isNativePlatform?.();

  if (isLocalHost && isNativeApp) {
    return fallbackTunnelBase;
  }

  if (isLocalHost) {
    return localhostBase;
  }

  if (hostname.includes('.devtunnels.ms')) {
    const backendHost = hostname.replace(/-8100(\.)/i, '-5000$1');
    return `${protocol}//${backendHost}`;
  }

  return fallbackTunnelBase;
};

const backendBaseUrl = resolveBackendBaseUrl();

export const environment = {
  production: true,
  apiUrl: `${backendBaseUrl}/api`,
  baseUrl: backendBaseUrl,
  uploadUrl: `${backendBaseUrl}/uploads`,
  socketUrl: backendBaseUrl,
  googleClientId: '442106181123-24duo2db3chep7m4amp2dghrtlonv5mo.apps.googleusercontent.com'
};
