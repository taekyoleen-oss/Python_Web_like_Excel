// IndexedDB 래퍼 — 실패 시 메모리 Map으로 강등, 워크북 LRU 최대 20개

import { openDB, type IDBPDatabase } from "idb";
import type { Workbook } from "@/types/workbook";

export interface AppSettings {
  theme?: string;
  splitRatio?: number;
  bottomPanelHeight?: number;
  fontSize?: number;
  lastWorkbookId?: string;
  pyodideIndexUrl?: string;
}

const DB_NAME = "pygrid";
const MAX_WORKBOOKS = 20;

let degraded = false;
/** IndexedDB 접근 실패로 메모리 저장으로 강등되었는지 (새로고침 시 데이터 소실) */
export const isStorageDegraded = (): boolean => degraded;

const mem = {
  workbooks: new Map<string, Workbook>(),
  blobs: new Map<string, Blob>(),
  settings: new Map<string, AppSettings>(),
};

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDb(): Promise<IDBPDatabase | null> {
  if (degraded) return null;
  try {
    dbPromise ??= openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore("workbooks");
        db.createObjectStore("blobs");
        db.createObjectStore("settings");
      },
    });
    return await dbPromise;
  } catch {
    degraded = true;
    return null;
  }
}

async function evictLru(db: IDBPDatabase): Promise<void> {
  // ponytail: getAll 전체 로드 — 워크북 20+개 × 수 MB가 문제 되면 updatedAt 인덱스로 교체
  const all: Workbook[] = await db.getAll("workbooks");
  if (all.length <= MAX_WORKBOOKS) return;
  all.sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1));
  for (const wb of all.slice(0, all.length - MAX_WORKBOOKS)) {
    await db.delete("workbooks", wb.id);
    for (const block of wb.pyBlocks) {
      if (block.last?.imageBlobId) await db.delete("blobs", block.last.imageBlobId);
    }
  }
}

export async function getWorkbook(id: string): Promise<Workbook | undefined> {
  const db = await getDb();
  if (db) {
    try {
      return await db.get("workbooks", id);
    } catch {
      degraded = true;
    }
  }
  return mem.workbooks.get(id);
}

export async function putWorkbook(wb: Workbook): Promise<void> {
  const db = await getDb();
  if (db) {
    try {
      await db.put("workbooks", wb, wb.id);
      await evictLru(db);
      return;
    } catch {
      degraded = true;
    }
  }
  mem.workbooks.set(wb.id, wb);
}

export async function deleteWorkbook(id: string): Promise<void> {
  const db = await getDb();
  if (db) {
    try {
      const wb: Workbook | undefined = await db.get("workbooks", id);
      await db.delete("workbooks", id);
      for (const block of wb?.pyBlocks ?? []) {
        if (block.last?.imageBlobId) await db.delete("blobs", block.last.imageBlobId);
      }
      return;
    } catch {
      degraded = true;
    }
  }
  const memWb = mem.workbooks.get(id);
  for (const block of memWb?.pyBlocks ?? []) {
    if (block.last?.imageBlobId) mem.blobs.delete(block.last.imageBlobId);
  }
  mem.workbooks.delete(id);
}

export async function listWorkbooks(): Promise<Workbook[]> {
  const db = await getDb();
  if (db) {
    try {
      const all: Workbook[] = await db.getAll("workbooks");
      return all.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } catch {
      degraded = true;
    }
  }
  return [...mem.workbooks.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const db = await getDb();
  if (db) {
    try {
      return await db.get("blobs", id);
    } catch {
      degraded = true;
    }
  }
  return mem.blobs.get(id);
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDb();
  if (db) {
    try {
      await db.put("blobs", blob, id);
      return;
    } catch {
      degraded = true;
    }
  }
  mem.blobs.set(id, blob);
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  const db = await getDb();
  if (db) {
    try {
      return await db.get("settings", "app");
    } catch {
      degraded = true;
    }
  }
  return mem.settings.get("app");
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = (await loadSettings()) ?? {};
  const next = { ...current, ...patch };
  const db = await getDb();
  if (db) {
    try {
      await db.put("settings", next, "app");
      return;
    } catch {
      degraded = true;
    }
  }
  mem.settings.set("app", next);
}
