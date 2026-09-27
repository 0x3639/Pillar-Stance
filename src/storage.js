import { STORAGE_PREFIX } from './config';

export function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)) ?? fallback; }
  catch { return fallback; }
}

export function writeStored(key, value) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}
