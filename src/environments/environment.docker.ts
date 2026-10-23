/** Docker build: the admin and the API share one origin (nginx.conf proxies /api, /uploads and /hubs), so URLs are relative and CORS is not needed. */
export const environment = {
  production: true,
  /** PrimeNG Community License key (https://primeui.dev/licenses/community). Empty: PrimeNG shows a licence banner. */
  primeLicense: '',
  apiUrl: '',
};
