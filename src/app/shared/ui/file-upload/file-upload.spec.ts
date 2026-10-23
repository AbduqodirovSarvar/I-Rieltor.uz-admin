import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import { I18n } from '../../../core/i18n/i18n.service';
import { FILE_RULES, validateFile } from './file-rules';
import { FileUpload } from './file-upload';

const file = (name: string, bytes = 100) => new File([new Uint8Array(bytes)], name);

describe('validateFile', () => {
  const i18n = new I18n();

  it('accepts a file of an allowed type and size', () => {
    expect(validateFile(file('foto.PNG'), FILE_RULES.image, i18n)).toBeNull();
    expect(validateFile(file('hujjat.pdf'), FILE_RULES.private, i18n)).toBeNull();
  });

  it('refuses another type, an empty file and a file that is too big, with the reason', () => {
    expect(validateFile(file('virus.exe'), FILE_RULES.image, i18n)).toContain(
      'virus.exe: bu turdagi fayl mumkin emas',
    );
    expect(validateFile(file('video.mp4'), FILE_RULES.private, i18n)).toContain('mp4');
    expect(validateFile(file('bos.png', 0), FILE_RULES.image, i18n)).toContain('bos.png');
    expect(validateFile(file('katta.pdf', 10 * 1024 * 1024 + 1), FILE_RULES.private, i18n)).toBe(
      'katta.pdf: hajmi 10 MB dan oshmasligi kerak',
    );
    expect(validateFile(file('hujjat.docx'), FILE_RULES.image, i18n)).toContain(
      'png, jpg, jpeg, gif',
    );
  });
});

@Component({
  imports: [FileUpload],
  template: `<app-file-upload
    [rule]="'image'"
    [multiple]="multiple"
    (filesChange)="emitted.push($event)"
  />`,
})
class Host {
  multiple = true;
  readonly emitted: File[][] = [];
}

describe('FileUpload', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [providePrimeNG({})] });
    URL.createObjectURL = () => 'blob:preview';
    URL.revokeObjectURL = () => undefined;
  });

  function drop(
    fixture: { debugElement: ReturnType<typeof TestBed.createComponent>['debugElement'] },
    files: File[],
  ) {
    const zone = fixture.debugElement.query(By.css('.drop'));
    const event = new Event('drop') as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: { files } });
    zone.nativeElement.dispatchEvent(event);
  }

  it('lists accepted files, reports refused ones, and emits the accepted', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    drop(fixture, [file('a.png'), file('bad.exe'), file('b.jpg')]);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.list li').length).toBe(2);
    expect(el.querySelector('.error')?.textContent).toContain('bad.exe');
    expect(fixture.componentInstance.emitted.at(-1)?.map((f) => f.name)).toEqual([
      'a.png',
      'b.jpg',
    ]);
    expect(el.querySelectorAll('.list img').length).toBe(2);
  });

  it('keeps only the newest file when several are not allowed', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.multiple = false;
    await fixture.whenStable();
    drop(fixture, [file('a.png')]);
    drop(fixture, [file('b.png')]);
    await fixture.whenStable();
    expect(fixture.componentInstance.emitted.at(-1)?.map((f) => f.name)).toEqual(['b.png']);
  });

  it('removes a file from the list', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    drop(fixture, [file('a.png'), file('b.png')]);
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.list li button')
      ?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.emitted.at(-1)?.map((f) => f.name)).toEqual(['b.png']);
  });
});
