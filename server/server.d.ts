/**
 * Types for the server modules, so the tests can import them.
 *
 * The server is plain JavaScript — it runs under Node with no build step, which
 * is deliberate. The tests are TypeScript, so they need to be told the shape of
 * what they are importing; this declares only what the tests actually reach for.
 */

declare module '*/server/users.js' {
  export interface PasswordRecord {
    password_salt?: string
    password_hash?: string
  }
  export function hashPassword(password: string, salt?: string): { salt: string; hash: string }
  export function passwordMatches(password: unknown, record: PasswordRecord | null | undefined): boolean
  export function normaliseUsername(raw: unknown): string
  export function seedOwner(): Promise<unknown>
  export const MAX_FAILURES: number
}

declare module '*/server/auth.js' {
  export function canReach(
    account: { role?: string; sections?: string[]; active?: boolean } | null | undefined,
    section: string,
  ): boolean
  export function authRequired(): boolean
}

declare module '*/server/sections.js' {
  export const KEY_SECTIONS: Record<string, string>
  export const SECTION_IDS: string[]
}

declare module '*/server/db.js' {
  import type { Pool } from 'pg'
  export function db(): Pool
  export function migrate(): Promise<void>
  export function readState(key: string): Promise<{ value: unknown } | null>
  export function writeState(key: string, value: unknown, updatedBy?: string | null): Promise<void>
  export function readHistory(key: string, limit?: number): Promise<unknown[]>
  export function readHistoryEntry(id: number): Promise<{ key: string; value: unknown } | null>
}

declare module '*/server/app.js' {
  import type { Express } from 'express'
  export const app: Express
  export const health: { ready: boolean; error: string | null }
}
