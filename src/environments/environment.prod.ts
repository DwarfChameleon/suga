const resolveBackendBaseUrl = (): string => {
  const renderBackendBase = 'https://suga-server.onrender.com';

  if (typeof window === 'undefined') {
    return renderBackendBase;
  }

  const { protocol, hostname } = window.location;

  if (hostname.includes('.devtunnels.ms')) {
    const backendHost = hostname.replace(/-8100(\.)/i, '-5000$1');
    return `${protocol}//${backendHost}`;
  }

  return renderBackendBase;
};

const backendBaseUrl = resolveBackendBaseUrl();

export const environment = {
  production: true,
  apiUrl: `${backendBaseUrl}/api`,
  baseUrl: backendBaseUrl,
  uploadUrl: `${backendBaseUrl}/uploads`,
  socketUrl: backendBaseUrl,
  googleClientId: '580684284008-3hchjufr7hhu18agbqis8dghcd1m1p50.apps.googleusercontent.com'
};
