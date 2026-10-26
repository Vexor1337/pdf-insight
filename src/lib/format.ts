import type { DocumentType } from '../../shared/schema.ts';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
};

export function documentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[type];
}

export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value);
  } catch {
    return `${new Intl.NumberFormat('pl-PL').format(value)} ${currency}`;
  }
}

export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day ?? ''}.${month ?? ''}.${year ?? ''}`;
}

export function languageLabel(code: string): string {
  try {
    return new Intl.DisplayNames(['pl'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
