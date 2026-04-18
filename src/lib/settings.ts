import { getDb } from './db';

const CACHE_TTL_MS = 30 * 1000; // 30초 캐시 (설정 변경 반영 지연 최소화)
let cache: { settings: Record<string, string>; at: number } | null = null;

async function ensureTable() {
  const sql = getDb();
  await sql`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.settings;
  try {
    await ensureTable();
    const sql = getDb();
    const rows = await sql`SELECT key, value FROM settings`;
    const map: Record<string, string> = {};
    for (const r of rows as Array<{ key: string; value: string }>) map[r.key] = r.value;
    cache = { settings: map, at: Date.now() };
    return map;
  } catch {
    return {};
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureTable();
  const sql = getDb();
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
  `;
  cache = null; // 무효화
}

/** 셔플 설정 조회 — 기본값: 활성, 2시간 */
export async function getShuffleConfig(): Promise<{ enabled: boolean; intervalHours: number }> {
  const s = await getAllSettings();
  const enabled = s.shuffle_enabled !== 'false'; // 기본 true
  const hours = Number(s.shuffle_interval_hours) || 2;
  return { enabled, intervalHours: Math.max(1, Math.min(168, hours)) }; // 1시간 ~ 1주일
}
