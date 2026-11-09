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
