const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const apiOrigin =
  configuredApiUrl ||
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000'
    : 'https://usta-bul.onrender.com');

export function apiUrl(path: string): string {
  if (!apiOrigin) {
    throw new Error('NEXT_PUBLIC_API_URL ortam değişkeni tanımlanmalıdır.');
  }
  return `${apiOrigin.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('usta_bul_user');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.token || '';
  } catch {
    return '';
  }
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}
