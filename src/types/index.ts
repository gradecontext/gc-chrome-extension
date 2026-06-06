// ─── Source apps the extension monitors ──────────────────────────────────────

export type SourceApp = "jira" | "figma" | "hubspot"

// ─── Detected event from a content script ────────────────────────────────────
// Maps to ObservedEvent in the backend schema.

export interface DetectedEvent {
  id: string // client-side uuid, correlates with ObservedEvent after sync
  site: SourceApp
  eventType: string // e.g. "JIRA_ISSUE_STATUS_DONE", "FIGMA_COMMENT_RESOLVED"
  sourceUrl: string
  externalEntityId?: string // Jira issue key, Figma comment ID, HubSpot deal ID
  title?: string
  description?: string
  rawData?: Record<string, unknown>
  occurredAt: string // ISO 8601
}

// ─── Decision payload — sent to backend ──────────────────────────────────────
// Matches the Decision model; ObservedEvent is created alongside it.

export interface DecisionPayload {
  observedEventClientId: string // local id from DetectedEvent.id
  summary: string
  rationale?: string
  tags: string[]
  decisionType: DecisionType
  sourceApp: SourceApp
  sourceUrl: string
  externalEntityId?: string
  occurredAt: string
}

// ─── Enums matching Prisma schema ────────────────────────────────────────────

export type DecisionType =
  | "DISCOUNT"
  | "ONBOARDING"
  | "PAYMENT_TERMS"
  | "CREDIT_EXTENSION"
  | "PARTNERSHIP"
  | "RENEWAL"
  | "ESCALATION"
  | "CUSTOM"

export type DecisionStatus =
  | "PROPOSED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "OVERRIDDEN"
  | "EXPIRED"
  | "ESCALATED"

// ─── Messages passed between content scripts ↔ background ─────────────────

export type ExtensionMessage =
  | { type: "DECISION_DETECTED"; payload: DetectedEvent }
  | { type: "OPEN_SIDE_PANEL"; payload: DetectedEvent }
  | { type: "DISMISS_PROMPT"; payload: { eventId: string } }
  | { type: "SAVE_DECISION"; payload: DecisionPayload }
  | { type: "GET_PENDING_EVENT" }
  | { type: "PENDING_EVENT_RESPONSE"; payload: DetectedEvent | null }
  | { type: "DECISION_SAVED_OK"; payload: { decisionId: string } }
  | { type: "DECISION_SAVE_ERROR"; payload: { message: string } }
  | { type: "SYNC_QUEUE_STATUS"; payload: { queued: number } }
  // Auth messages
  | { type: "WEBAPP_SESSION"; payload: SupabaseRawSession }
  | { type: "GET_AUTH_STATE" }
  | { type: "SIGN_OUT" }

// ─── Cached / local storage shapes ───────────────────────────────────────────

export interface CachedDecision {
  id: string
  payload: DecisionPayload
  status: "pending" | "synced" | "failed"
  createdAt: string
  syncedAt?: string
  retries: number
}

export interface ExtensionSettings {
  apiUrl: string
  enabled: boolean
  enabledSites: Record<SourceApp, boolean>
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SupabaseRawSession {
  access_token: string
  refresh_token: string
  expires_at: number // Unix timestamp (seconds)
  token_type: string
}

export interface MembershipInfo {
  id: number
  clientId: number
  role: string
  status: string
  client: {
    id: number
    name: string
    slug: string
    plan: string
  }
}

export interface UserProfile {
  id: number
  supabaseAuthId: string
  email: string
  name: string | null
  displayName: string | null
  memberships: MembershipInfo[]
}

export interface AuthState {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp (seconds)
  user: UserProfile
  activeClientId: number
}

// ─── Messages: auth additions ─────────────────────────────────────────────────
// (merged into ExtensionMessage union below)

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiDecisionResponse {
  id: string
  summary: string
  status: DecisionStatus
  createdAt: string
}

export interface ApiObservedEventResponse {
  id: string
  eventType: string
  createdAt: string
}
