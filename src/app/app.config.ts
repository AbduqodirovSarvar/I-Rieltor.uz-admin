import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TitleStrategy, provideRouter } from '@angular/router';
import { PrimeNG, providePrimeNG } from 'primeng/config';
import { I18n } from './core/i18n/i18n.service';
import { primeLocale } from './core/i18n/primeng-locale';
import { MessageService, ConfirmationService } from 'primeng/api';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AppTitleStrategy } from './core/layout/page-title';
import { GlobalErrorHandler } from './core/notify/global-error-handler';
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
      license: environment.primeLicense || undefined,
    }),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // The calendar and button texts of the UI library, in the language of the panel.
    provideAppInitializer(() => inject(PrimeNG).setTranslation(primeLocale(inject(I18n).lang))),
    provideAppInitializer(() => inject(AuthService).restore()),
    MessageService,
    ConfirmationService,
  ],
};
