import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { FileSizePipe } from '../../../core/format/format';
import { I18n } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { FILE_RULES, FileRule, FileRuleName, isImage, validateFile } from './file-rules';

interface Picked {
  file: File;
  /** Object URL of a picture, for the preview. */
  preview: string | null;
}

/**
 * Pick files by click or by dropping them. Files that break the rule (type, size) are refused at once with a reason;
 * the others are listed (pictures with a preview) and emitted through `filesChange`. The upload itself is the caller's.
 */
@Component({
  selector: 'app-file-upload',
  imports: [ButtonModule, FileSizePipe, TPipe],
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss',
})
export class FileUpload implements OnDestroy {
  /** A preset (`image`, `video`, `document`, `private`) or a custom rule. */
  readonly rule = input<FileRuleName | FileRule>('image');
  readonly multiple = input(false);
  readonly disabled = input(false);
  readonly filesChange = output<File[]>();

  private readonly i18n = inject(I18n);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  protected readonly picked = signal<Picked[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly dragging = signal(false);

  protected readonly resolved = computed<FileRule>(() => {
    const rule = this.rule();
    return typeof rule === 'string' ? FILE_RULES[rule] : rule;
  });
  protected readonly accept = computed(() =>
    this.resolved()
      .extensions.map((e) => `.${e}`)
      .join(','),
  );
  protected readonly hint = computed(
    () => `${this.resolved().extensions.join(', ')} · ≤ ${this.resolved().maxMb} MB`,
  );

  /** The accepted files, for the caller that reads them on a button click. */
  files(): File[] {
    return this.picked().map((p) => p.file);
  }

  clear(): void {
    this.revoke(this.picked());
    this.picked.set([]);
    this.errors.set([]);
    this.input().nativeElement.value = '';
    this.filesChange.emit([]);
  }

  protected open(): void {
    if (!this.disabled()) this.input().nativeElement.click();
  }

  protected onPick(event: Event): void {
    const element = event.target as HTMLInputElement;
    this.add(Array.from(element.files ?? []));
    element.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (this.disabled()) return;
    this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragging.set(true);
  }

  protected remove(index: number): void {
    const current = this.picked();
    this.revoke([current[index]]);
    this.picked.set(current.filter((_, i) => i !== index));
    this.filesChange.emit(this.files());
  }

  ngOnDestroy(): void {
    this.revoke(this.picked());
  }

  private add(candidates: File[]): void {
    const problems: string[] = [];
    const accepted: Picked[] = [];
    for (const file of candidates) {
      const problem = validateFile(file, this.resolved(), this.i18n);
      if (problem) problems.push(problem);
      else accepted.push({ file, preview: isImage(file) ? URL.createObjectURL(file) : null });
    }
    this.errors.set(problems);
    if (accepted.length === 0) return;

    if (this.multiple()) {
      this.picked.update((current) => [...current, ...accepted]);
    } else {
      // One file: the new one replaces the old one.
      this.revoke(this.picked());
      this.revoke(accepted.slice(1));
      this.picked.set([accepted[0]]);
    }
    this.filesChange.emit(this.files());
  }

  private revoke(items: readonly (Picked | undefined)[]): void {
    for (const item of items) if (item?.preview) URL.revokeObjectURL(item.preview);
  }
}
