import type { Locale } from '../config';
import { type Dictionary, en } from './en';
import { es } from './es';

export type { Dictionary };

export const dictionaries: Record<Locale, Dictionary> = { en, es };
