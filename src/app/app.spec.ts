import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), providePrimeNG({}), MessageService, ConfirmationService],
    }).compileComponents();
  });

  it('should create the app with the toast and the confirmation container', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance).toBeTruthy();
    expect(el.querySelector('p-toast')).toBeTruthy();
    expect(el.querySelector('p-confirmdialog')).toBeTruthy();
  });
});
