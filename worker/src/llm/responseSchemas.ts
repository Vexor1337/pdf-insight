import { DOCUMENT_TYPES } from '../../../shared/schema.ts';

const nullableString = { type: ['string', 'null'] };
const stringArray = { type: 'array', items: { type: 'string' } };

export const ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    document: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'ISO 639-1, np. "pl"' },
        type: { type: 'string', enum: [...DOCUMENT_TYPES] },
        title: nullableString,
        date: { ...nullableString, description: 'YYYY-MM-DD lub null' },
      },
      required: ['language', 'type', 'title', 'date'],
    },
    summary: { type: 'string' },
    keyPoints: stringArray,
    entities: {
      type: 'object',
      properties: { organizations: stringArray, people: stringArray },
      required: ['organizations', 'people'],
    },
    amounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'number' },
          currency: { type: 'string', description: 'ISO 4217' },
          context: { type: 'string' },
        },
        required: ['value', 'currency', 'context'],
      },
    },
    dates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string' }, context: { type: 'string' } },
        required: ['date', 'context'],
      },
    },
    keywords: stringArray,
  },
  required: ['document', 'summary', 'keyPoints', 'entities', 'amounts', 'dates', 'keywords'],
} as const;

export const OCR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { page: { type: 'integer' }, text: { type: 'string' } },
        required: ['page', 'text'],
      },
    },
  },
  required: ['pages'],
} as const;
