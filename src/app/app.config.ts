import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { MessageService, ConfirmationService } from 'primeng/api';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AppPreset, DARK_MODE_CLASS } from './core/theme/app-theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    providePrimeNG({
      theme: {
        preset: AppPreset,
        options: { darkModeSelector: `.${DARK_MODE_CLASS}`, cssLayer: false },
      },
      ripple: true,
    }),
    MessageService,
    ConfirmationService,
  ],
};
