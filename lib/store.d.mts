import type { Business } from "./types";
export const DATA_DIR: string;
export function readJSON<T = any>(file: string, fallback: T): T;
export function writeJSON(file: string, value: unknown): void;
export function businessConfig(env?: Record<string, string | undefined>): Business;
export function now(env?: Record<string, string | undefined>): Date;
