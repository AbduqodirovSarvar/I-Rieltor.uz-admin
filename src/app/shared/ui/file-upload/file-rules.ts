import { I18n } from '../../../core/i18n/i18n.service';

/** What the backend accepts, by purpose (extensions are checked there against the file's content as well). */
export interface FileRule {
  extensions: readonly string[];
  maxMb: number;
}

export const FILE_RULES = {
  /** Slide pictures, logos, property photos (`PropertyMediaKind.IMAGE`). */
  image: { extensions: ['png', 'jpg', 'jpeg', 'gif'], maxMb: 20 },
  /** `PropertyMediaKind.VIDEO`. */
  video: { extensions: ['mp4'], maxMb: 20 },
  /** `PropertyMediaKind.DOCUMENT`: papers and scans. */
  document: { extensions: ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg'], maxMb: 20 },
  /** Private documents and payment receipts. */
  private: { extensions: ['pdf', 'png', 'jpg', 'jpeg', 'docx'], maxMb: 10 },
} as const satisfies Record<string, FileRule>;

export type FileRuleName = keyof typeof FILE_RULES;

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isImage(file: File): boolean {
  return ['png', 'jpg', 'jpeg', 'gif'].includes(extensionOf(file.name));
}

/** The reason a file is refused, or null when it is fine. */
export function validateFile(file: File, rule: FileRule, i18n: I18n): string | null {
  if (!rule.extensions.includes(extensionOf(file.name))) {
    return i18n.t('common.fileType', { name: file.name, allowed: rule.extensions.join(', ') });
  }
  if (file.size > rule.maxMb * 1024 * 1024) {
    return i18n.t('common.fileTooBig', { name: file.name, max: rule.maxMb });
  }
  if (file.size === 0) {
    return i18n.t('common.fileType', { name: file.name, allowed: rule.extensions.join(', ') });
  }
  return null;
}
