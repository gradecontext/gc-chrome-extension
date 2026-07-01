import { Storage } from "@plasmohq/storage"
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "~lib/constants"
import type {
  AuthState,
  CachedDecision,
  DetectedEvent,
  ExtensionSettings,
  SubjectCompanySource
} from "~types"

const storage = new Storage({ area: "local" })

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<ExtensionSettings> {
  const saved = await storage.get<ExtensionSettings>(STORAGE_KEYS.SETTINGS)
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>
): Promise<void> {
  const current = await getSettings()
  await storage.set(STORAGE_KEYS.SETTINGS, { ...current, ...partial })
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export async function getAuthState(): Promise<AuthState | null> {
  return (await storage.get<AuthState>(STORAGE_KEYS.AUTH_STATE)) ?? null
}

export async function saveAuthState(state: AuthState): Promise<void> {
  await storage.set(STORAGE_KEYS.AUTH_STATE, state)
}

export async function clearAuthState(): Promise<void> {
  await storage.remove(STORAGE_KEYS.AUTH_STATE)
}

// ─── Pending event (shown in side panel) ─────────────────────────────────────

export async function getPendingEvent(): Promise<DetectedEvent | null> {
  return storage.get<DetectedEvent>(STORAGE_KEYS.PENDING_EVENT) ?? null
}

export async function setPendingEvent(event: DetectedEvent | null): Promise<void> {
  if (event === null) {
    await storage.remove(STORAGE_KEYS.PENDING_EVENT)
  } else {
    await storage.set(STORAGE_KEYS.PENDING_EVENT, event)
  }
}

// ─── Sync queue ───────────────────────────────────────────────────────────────

export async function getSyncQueue(): Promise<CachedDecision[]> {
  return (await storage.get<CachedDecision[]>(STORAGE_KEYS.SYNC_QUEUE)) ?? []
}

export async function addToSyncQueue(decision: CachedDecision): Promise<void> {
  const queue = await getSyncQueue()
  queue.push(decision)
  await storage.set(STORAGE_KEYS.SYNC_QUEUE, queue)
}

export async function updateQueueItem(
  id: string,
  updates: Partial<CachedDecision>
): Promise<void> {
  const queue = await getSyncQueue()
  const idx = queue.findIndex((d) => d.id === id)
  if (idx !== -1) {
    queue[idx] = { ...queue[idx], ...updates }
    await storage.set(STORAGE_KEYS.SYNC_QUEUE, queue)
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getSyncQueue()
  await storage.set(
    STORAGE_KEYS.SYNC_QUEUE,
    queue.filter((d) => d.id !== id)
  )
}

export async function getPendingQueueCount(): Promise<number> {
  const queue = await getSyncQueue()
  return queue.filter((d) => d.status === "pending" || d.status === "failed").length
}

// ─── First-run disclosure ─────────────────────────────────────────────────────

export async function getDisclosureAcknowledged(): Promise<boolean> {
  return (await storage.get<boolean>(STORAGE_KEYS.DISCLOSURE_ACKNOWLEDGED)) ?? false
}

export async function setDisclosureAcknowledged(): Promise<void> {
  await storage.set(STORAGE_KEYS.DISCLOSURE_ACKNOWLEDGED, true)
}

// ─── Tracked sources cache (GET /decisions/subject-companies) ────────────────

interface SourcesCache {
  sources: SubjectCompanySource[]
  fetchedAt: number
}

export async function getCachedSources(): Promise<SourcesCache | null> {
  return (await storage.get<SourcesCache>(STORAGE_KEYS.SOURCES_CACHE)) ?? null
}

export async function setCachedSources(sources: SubjectCompanySource[]): Promise<void> {
  await storage.set(STORAGE_KEYS.SOURCES_CACHE, { sources, fetchedAt: Date.now() })
}
