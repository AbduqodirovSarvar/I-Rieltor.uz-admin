import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/** Brand palette: deep blue. Change the primary scale here and every component follows. */
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
  },
});

/** Dark mode is switched by adding this class to <html> (see ThemeService). */
export const DARK_MODE_CLASS = 'app-dark';
