import { environment } from 'src/environments/environment';

export function resolveUploadUrl(value?: string, fallback = ''): string {
  const cleaned = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  if (!cleaned) return fallback;
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) {
    return cleaned;
  }
  if (cleaned.startsWith('uploads/')) {
    return `${environment.baseUrl}/${cleaned}`;
  }
  return `${environment.uploadUrl}/${cleaned}`;
}
