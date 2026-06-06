import { getSettings } from "~lib/storage"
import { getValidToken } from "~services/auth"
import type {
  ApiDecisionResponse,
  ApiObservedEventResponse,
  DecisionPayload,
  DetectedEvent
} from "~types"

async function buildHeaders(): Promise<HeadersInit> {
  const token = await getValidToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

async function baseUrl(): Promise<string> {
  const settings = await getSettings()
  return settings.apiUrl
}

// POST /observed-events — record a raw browser-detected event
export async function createObservedEvent(
  event: DetectedEvent,
  clientId: number
): Promise<ApiObservedEventResponse> {
  const [headers, url] = await Promise.all([buildHeaders(), baseUrl()])

  const body = {
    clientId,
    sourceApp: event.site,
    eventType: event.eventType,
    sourceUrl: event.sourceUrl,
    externalEntityId: event.externalEntityId,
    title: event.title,
    description: event.description,
    rawPayload: event.rawData ?? {},
    occurredAt: event.occurredAt
  }

  const res = await fetch(`${url}/observed-events`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ObservedEvent POST failed (${res.status}): ${err}`)
  }

  return res.json()
}

// POST /decisions — create a formal decision record
export async function createDecision(
  payload: DecisionPayload,
  clientId: number,
  observedEventId?: string
): Promise<ApiDecisionResponse> {
  const [headers, url] = await Promise.all([buildHeaders(), baseUrl()])

  const body = {
    clientId,
    summary: payload.summary,
    decisionType: payload.decisionType,
    status: "PROPOSED",
    decidedAt: payload.occurredAt,
    ...(observedEventId ? { observedEventId } : {}),
    notes: payload.rationale
      ? [
          {
            content: payload.rationale,
            sourceApp: payload.sourceApp,
            sourceUrl: payload.sourceUrl
          }
        ]
      : [],
    entities: payload.externalEntityId
      ? [
          {
            entityType: payload.sourceApp.toUpperCase(),
            entityId: payload.externalEntityId
          }
        ]
      : [],
    tags: payload.tags
  }

  const res = await fetch(`${url}/decisions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  if (res.status === 401) throw new Error("UNAUTHORIZED")
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Decision POST failed (${res.status}): ${err}`)
  }

  return res.json()
}
