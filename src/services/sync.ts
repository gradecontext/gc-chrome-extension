import { MAX_SYNC_RETRIES } from "~lib/constants"
import { getAuthState } from "~services/auth"
import { createDecision, createObservedEvent } from "~services/api"
import { getPendingDecisions, markRetry, markSynced, pruneQueue } from "~services/cache"
import type { DecisionPayload, DetectedEvent } from "~types"

// Flush the pending sync queue — called by the background alarm
export async function flushSyncQueue(): Promise<void> {
  const auth = await getAuthState()
  if (!auth) return // not authenticated — skip

  const pending = await getPendingDecisions()
  if (pending.length === 0) return

  for (const cached of pending) {
    try {
      const minimalEvent: DetectedEvent = {
        id: cached.payload.observedEventClientId,
        site: cached.payload.sourceApp,
        eventType: cached.payload.decisionType,
        sourceUrl: cached.payload.sourceUrl,
        externalEntityId: cached.payload.externalEntityId,
        title: cached.payload.summary,
        occurredAt: cached.payload.occurredAt
      }

      const observedEvent = await createObservedEvent(minimalEvent, auth.activeClientId)
      await createDecision(cached.payload, auth.activeClientId, observedEvent.id)
      await markSynced(cached.id)
    } catch (err) {
      // Don't retry on auth failures — wait for re-login
      if (err instanceof Error && err.message === "UNAUTHORIZED") break
      await markRetry(cached.id, MAX_SYNC_RETRIES)
    }
  }

  await pruneQueue()
}

// One-shot sync — used immediately after the user submits the decision form
export async function syncDecisionNow(
  detectedEvent: DetectedEvent,
  payload: DecisionPayload
): Promise<string> {
  const auth = await getAuthState()
  if (!auth) throw new Error("Not authenticated")

  const observedEvent = await createObservedEvent(detectedEvent, auth.activeClientId)
  const decision = await createDecision(payload, auth.activeClientId, observedEvent.id)

  return decision.id
}
