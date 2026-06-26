import { getSettings } from "~lib/storage"
import { getValidToken } from "~services/auth"
import type {
  ApiDecisionListResponse,
  ApiDecisionNote,
  ApiDecisionResponse,
  ApiEventResponse,
  DecisionContext,
  DecisionPayload,
  DetectedEvent,
  ReviewAction,
  SubjectCompanySource
} from "~types"

async function buildHeaders(clientId?: number): Promise<HeadersInit> {
  const token = await getValidToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(clientId != null ? { "X-Client-Id": String(clientId) } : {})
  }
}

async function baseUrl(): Promise<string> {
  const settings = await getSettings()
  // settings.apiUrl is e.g. "https://api.contextgrade.com/api" — append /v1
  return `${settings.apiUrl}/v1`
}

const log = (...args: unknown[]) => console.debug("[CG:api]", ...args)
const err = (...args: unknown[]) => console.error("[CG:api]", ...args)

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    err("401 Unauthorized —", res.url)
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    err(`${res.status} error on`, res.url, "—", text)
    throw new Error(`API error (${res.status}): ${text}`)
  }
  const json = await res.json()
  log(res.status, res.url, "→", json)
  return json as T
}

// POST /events — log a raw browser-detected event
export async function logEvent(
  event: DetectedEvent,
  clientId: number
): Promise<ApiEventResponse> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const body: Record<string, unknown> = {
    source_app: event.site,
    event_type: event.eventType,
    source_url: event.sourceUrl,
    raw_payload: event.rawData ?? {},
    occurred_at: event.occurredAt,
    metadata: {
      extension_version: "1.0.0",
      captured_at_local: new Date().toISOString()
    }
  }
  if (event.externalEntityId != null) body.external_entity_id = event.externalEntityId
  if (event.title != null) body.title = event.title
  if (event.description != null) body.description = event.description

  const res = await fetch(`${url}/events`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  return handleResponse<ApiEventResponse>(res)
}

// POST /decisions — lookup-only: external_id must match an active, pre-registered
// subject company (see listSubjectCompanies). The backend no longer auto-creates one.
export async function createDecision(
  payload: DecisionPayload,
  clientId: number,
  eventId?: string
): Promise<ApiDecisionResponse> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const body: Record<string, unknown> = {
    external_id: payload.externalId,
    decision_type: payload.decisionType,
    summary: payload.summary
  }
  if (payload.contextKey) body.context_key = payload.contextKey
  if (eventId) body.event_id = eventId

  // Note is sent inline — no separate POST /notes call needed
  if (payload.rationale) {
    body.note = {
      content: payload.rationale,
      source_app: payload.sourceApp,
      source_url: payload.sourceUrl
    }
  }

  const res = await fetch(`${url}/decisions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  return handleResponse<ApiDecisionResponse>(res)
}

// GET /decisions/contexts — load context dropdown options
export async function getContexts(clientId: number): Promise<DecisionContext[]> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const res = await fetch(`${url}/decisions/contexts`, { headers })
  const json = await handleResponse<{ data: DecisionContext[] }>(res)
  return json.data
}

// GET /decisions/subject-companies — list admin-registered tracked sources.
// The extension uses this to decide where to show its icon.
export async function listSubjectCompanies(clientId: number): Promise<SubjectCompanySource[]> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const res = await fetch(`${url}/decisions/subject-companies`, { headers })
  const json = await handleResponse<{ data: SubjectCompanySource[] }>(res)
  return json.data
}

// POST /decisions/:id/notes — attach a human reasoning note
export async function addDecisionNote(
  decisionId: string,
  content: string,
  clientId: number,
  sourceApp?: string,
  sourceUrl?: string
): Promise<ApiDecisionNote> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const body = {
    content,
    source_app: sourceApp ?? "chrome-extension",
    ...(sourceUrl ? { source_url: sourceUrl } : {})
  }

  const res = await fetch(`${url}/decisions/${decisionId}/notes`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  return handleResponse<ApiDecisionNote>(res)
}

// POST /decisions/:id/review — approve, reject, escalate, or override
export async function reviewDecision(
  decisionId: string,
  action: ReviewAction,
  clientId: number,
  note?: string,
  finalAction?: string
): Promise<ApiDecisionResponse> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const body: Record<string, unknown> = {
    action,
    ...(note ? { note } : {}),
    ...(finalAction ? { final_action: finalAction } : {})
  }

  const res = await fetch(`${url}/decisions/${decisionId}/review`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  return handleResponse<ApiDecisionResponse>(res)
}

// GET /decisions/:id — fetch a single decision (confirmation screen)
export async function getDecision(
  decisionId: string,
  clientId: number
): Promise<ApiDecisionResponse> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const res = await fetch(`${url}/decisions/${decisionId}`, { headers })
  return handleResponse<ApiDecisionResponse>(res)
}

// GET /decisions — list recent decisions (popup dashboard tab)
export async function listDecisions(
  clientId: number,
  params?: { status?: string; decision_type?: string; page?: number; limit?: number }
): Promise<ApiDecisionListResponse> {
  const [headers, url] = await Promise.all([buildHeaders(clientId), baseUrl()])

  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  if (params?.decision_type) qs.set("decision_type", params.decision_type)
  if (params?.page != null) qs.set("page", String(params.page))
  if (params?.limit != null) qs.set("limit", String(params.limit))

  const query = qs.toString()
  const res = await fetch(`${url}/decisions${query ? `?${query}` : ""}`, { headers })
  return handleResponse<ApiDecisionListResponse>(res)
}
