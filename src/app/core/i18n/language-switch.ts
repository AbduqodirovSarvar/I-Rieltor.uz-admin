import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { I18n, LANGS, Lang, LANG_NAME } from './i18n.service';
import { TPipe } from './t.pipe';

/** The language menu of the panel: Uzbek (Latin), Russian, English, Uzbek (Cyrillic). The page reloads when it changes. */
@Component({
  selector: 'app-language-switch',
  imports: [FormsModule, SelectModule, TPipe],
  template: `
    <p-select
      [options]="options"
      optionLabel="label"
      optionValue="value"
      [ngModel]="i18n.lang"
      (ngModelChange)="i18n.setLang($event)"
      [ariaLabel]="'common.language' | t"
      [style]="{ width: '9rem' }"
    />
  `,
})
export class LanguageSwitch {
  protected readonly i18n = inject(I18n);
  protected readonly options = LANGS.map((value: Lang) => ({ value, label: LANG_NAME[value] }));
}
