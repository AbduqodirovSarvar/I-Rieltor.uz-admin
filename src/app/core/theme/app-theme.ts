import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Brand look of the panel (the "Admin Panel" design): blue primary, cool grey surfaces, dense 8-12 px corners.
 * Change the scales here and every PrimeNG component follows.
 */
export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}',
    },
    formField: { borderRadius: '8px' },
    content: { borderRadius: '12px' },
    overlay: {
      select: { borderRadius: '10px' },
      popover: { borderRadius: '10px' },
      modal: { borderRadius: '14px' },
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f4f6fb',
          100: '#eceff7',
          200: '#e1e5ee',
          300: '#cbd2e0',
          400: '#8a93a6',
          500: '#5b6475',
          600: '#475066',
          700: '#3b4456',
          800: '#1e293b',
          900: '#0f172a',
          950: '#0b1020',
        },
        primary: {
          color: '#1d4ed8',
          contrastColor: '#ffffff',
          hoverColor: '#1e40af',
          activeColor: '#1e3a8a',
        },
        text: {
          color: '{surface.900}',
          hoverColor: '{surface.950}',
          mutedColor: '{surface.500}',
          hoverMutedColor: '{surface.600}',
        },
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f1f4fa',
          100: '#e6eaf2',
          200: '#cbd5e1',
          300: '#98a2b3',
          400: '#8c98b0',
          500: '#6b7589',
          600: '#3a4558',
          700: '#263041',
          800: '#1f2734',
          900: '#171d27',
          950: '#0f131b',
        },
        primary: {
          color: '#6b93ff',
          contrastColor: '#0b1020',
          hoverColor: '#8aa9ff',
          activeColor: '#a5b8f3',
        },
        // Given here too: the light text colours above otherwise leak into dark mode (dark text on dark cards).
        text: {
          color: '{surface.0}',
          hoverColor: '{surface.0}',
          mutedColor: '{surface.400}',
          hoverMutedColor: '{surface.300}',
        },
      },
    },
  },
});

/** Dark mode is switched by adding this class to <html> (see ThemeService). */
export const DARK_MODE_CLASS = 'app-dark';
