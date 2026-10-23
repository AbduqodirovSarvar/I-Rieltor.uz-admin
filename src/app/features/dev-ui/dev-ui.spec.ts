import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { DevUi } from './dev-ui';

describe('DevUi', () => {
  it('renders the table rows, the form controls and the dialog trigger', async () => {
    await TestBed.configureTestingModule({
      imports: [DevUi],
      providers: [provideRouter([]), providePrimeNG({}), MessageService],
    }).compileComponents();

    const fixture = TestBed.createComponent(DevUi);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('input[aria-label="Qidiruv"]')).toBeTruthy();
    expect(el.textContent).toContain('Toshkent, 3 xonali kvartira');
  });
});
