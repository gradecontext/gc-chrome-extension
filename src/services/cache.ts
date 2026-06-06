import {
  addToSyncQueue,
  getSyncQueue,
  removeFromQueue,
  updateQueueItem
} from "~lib/storage"
import { generateId, now } from "~lib/utils"
import type { CachedDecision, DecisionPayload } from "~types"

// Enqueue a decision for background sync
export async function enqueueDecision(
  payload: DecisionPayload
): Promise<CachedDecision> {
  const cached: CachedDecision = {
    id: generateId(),
    payload,
    status: "pending",
    createdAt: now(),
    retries: 0
  }
  await addToSyncQueue(cached)
  return cached
}

// Mark a queued decision as successfully synced
export async function markSynced(id: string): Promise<void> {
  await updateQueueItem(id, { status: "synced", syncedAt: now() })
}

// Increment retry count; flip to "failed" once MAX_SYNC_RETRIES is exceeded
export async function markRetry(
  id: string,
  maxRetries: number
): Promise<void> {
  const queue = await getSyncQueue()
  const item = queue.find((d) => d.id === id)
  if (!item) return

  const retries = item.retries + 1
  await updateQueueItem(id, {
    retries,
    status: retries >= maxRetries ? "failed" : "pending"
  })
}

// Returns decisions that should be retried
export async function getPendingDecisions(): Promise<CachedDecision[]> {
  const queue = await getSyncQueue()
  return queue.filter((d) => d.status === "pending")
}

// Hard-remove synced items from the queue to keep storage clean
export async function pruneQueue(): Promise<void> {
  const queue = await getSyncQueue()
  for (const item of queue) {
    if (item.status === "synced") {
      await removeFromQueue(item.id)
    }
  }
}
