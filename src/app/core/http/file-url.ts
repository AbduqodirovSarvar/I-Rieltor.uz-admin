import { environment } from '../../../environments/environment';

/**
 * The address of an uploaded file for an `<img>` or a link. The backend returns `PublicBaseUrl + path` when that is
 * configured, otherwise a relative `/uploads/...` that has to be read from the API's host.
 */
export function fileUrl(url: string | null | undefined): string {
  if (!url) return '';
  return /^https?:\/\//i.test(url)
    ? url
    : `${environment.apiUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}
