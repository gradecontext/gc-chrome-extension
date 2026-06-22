import { MAX_SYNC_RETRIES } from "~lib/constants"
import { clearAuthState } from "~lib/storage"
import { getAuthState } from "~services/auth"
import { createDecision, logEvent } from "~services/api"
import { getPendingDecisions, markRetry, markSynced, pruneQueue } from "~services/cache"
import type { DecisionPayload, DetectedEvent, SyncResult } from "~types"

// Flush the pending sync queue — called by the background alarm
export async function flushSyncQueue(): Promise<void> {
  const auth = await getAuthState()
  if (!auth) return

  const pending = await getPendingDecisions()
  if (pending.length === 0) return

  for (const cached of pending) {
    try {
      const minimalEvent: DetectedEvent = {
        id: cached.id,
        site: cached.payload.sourceApp,
        eventType: cached.payload.decisionType,
        sourceUrl: cached.payload.sourceUrl,
        externalEntityId: cached.payload.externalEntityId,
        title: cached.payload.subjectCompany?.name,
        occurredAt: cached.payload.occurredAt
      }

      const event = await logEvent(minimalEvent, auth.activeClientId)
      await createDecision(cached.payload, auth.activeClientId, event.id)
      await markSynced(cached.id)
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        await clearAuthState()
        break
      }
      await markRetry(cached.id, MAX_SYNC_RETRIES)
    }
  }

  await pruneQueue()
}

const log = (...args: unknown[]) => console.debug("[CG:sync]", ...args)
const err = (...args: unknown[]) => console.error("[CG:sync]", ...args)

// One-shot sync — used immediately after the user submits the decision form
export async function syncDecisionNow(
  detectedEvent: DetectedEvent,
  payload: DecisionPayload
): Promise<SyncResult> {
  const auth = await getAuthState()
  if (!auth) throw new Error("Not authenticated")

  log("POST /events —", detectedEvent.site, detectedEvent.eventType)
  const event = await logEvent(detectedEvent, auth.activeClientId)
  log("event logged — id:", event.id)

  log("POST /decisions —", payload.decisionType, "summary:", payload.summary, "contextKey:", payload.contextKey ?? "none")
  const decision = await createDecision(payload, auth.activeClientId, event.id)
  log("decision created — id:", decision.id, "status:", decision.status, "recommendation:", decision.recommendation?.recommendation ?? "none")

  return {
    decisionId: decision.id,
    recommendation: decision.recommendation,
    status: decision.status
  }
}
