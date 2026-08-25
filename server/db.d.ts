/**
 * Types for the server's data layer. The server itself is plain JavaScript —
 * it needs no build step, which keeps the Railway deploy to `npm start` — but
 * the tests are TypeScript, so the surface is declared here.
 */
import type { Pool } from 'pg'

export interface StateRow<T = unknown> {
  value: T
  updated_at: string
  updated_by: string | null
}

export interface HistoryRow {
  id: string
  saved_at: string
  saved_by: string | null
}

export interface HistoryEntry<T = unknown> {
  key: string
  value: T
  saved_at: string
}

export function db(): Pool
export function migrate(): Promise<void>
export function readState<T = unknown>(key: string): Promise<StateRow<T> | null>
export function writeState<T = unknown>(key: string, value: T, updatedBy?: string | null): Promise<void>
export function readHistory(key: string, limit?: number): Promise<HistoryRow[]>
export function readHistoryEntry<T = unknown>(id: number): Promise<HistoryEntry<T> | null>
