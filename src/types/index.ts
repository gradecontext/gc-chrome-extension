// ─── Source apps the extension monitors ──────────────────────────────────────

export type SourceApp = "jira" | "figma" | "hubspot"

// ─── Detected event from a content script ────────────────────────────────────

export interface DetectedEvent {
  id: string
  // Detectors emit the literal SourceApp; manual entries on generic
  // admin-registered domains use the resolved hostname (e.g. "lattice.com").
  site: SourceApp | string
  eventType: string
  sourceUrl: string
  externalEntityId?: string
  title?: string
  description?: string
  rawData?: Record<string, unknown>
  occurredAt: string // ISO 8601
  // Resolved at detection time by matching window.location against the
  // client's registered subject companies — required for decision creation.
  sourceCompanyExternalId?: string
  sourceCompanyName?: string
}

// ─── Decision payload — sent via SAVE_DECISION background message ─────────────

export interface DecisionPayload {
  decisionType: string
  contextCategory: string
  summary: string          // "What was decided?" — becomes the decision title
  rationale?: string       // "Why?" — sent inline as note.content alongside summary
  externalId: string       // pre-registered SubjectCompany.external_id (e.g. "figma.com")
  sourceApp: SourceApp | string
  sourceUrl: string
  externalEntityId?: string
  occurredAt: string
}

// ─── Subject companies (admin-managed tracked sources) ────────────────────────

export interface SubjectCompanySource {
  id: number
  client_id: number
  external_id: string
  name: string
  domain: string
  active: boolean
  industry?: string
  country?: string
  created_at: string
  updated_at: string
}

// ─── Enums matching backend schema ───────────────────────────────────────────

export type DecisionStatus =
  | "PROPOSED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "OVERRIDDEN"
  | "EXPIRED"
  | "ESCALATED"

export type ReviewAction = "approve" | "reject" | "escalate" | "override"

// ─── Decision types (dropdown options) ────────────────────────────────────────

export interface DecisionTypeOption {
  id: string
  client_id: number
  decision_type: string
  label: string | null
  is_reserved: boolean
  active: boolean
  created_at: string
  updated_at: string
}

// ─── Context categories (dropdown options) ────────────────────────────────────

export interface ContextCategory {
  id: string
  client_id: number
  category: string
  label: string | null
  is_reserved: boolean
  active: boolean
  created_at: string
  updated_at: string
}

// ─── AI recommendation returned with every decision ───────────────────────────

export interface DecisionRecommendation {
  recommendation: "APPROVE" | "REJECT" | "ESCALATE"
  confidence: "high" | "medium" | "low"
  rationale: string[]
  suggested_conditions: string[]
}

// ─── Messages passed between content scripts ↔ background ─────────────────

export type ExtensionMessage =
  | { type: "DECISION_DETECTED"; payload: DetectedEvent }
  | { type: "OPEN_SIDE_PANEL"; payload: DetectedEvent }
  | { type: "OPEN_PANEL" }
  | { type: "DISMISS_PROMPT"; payload: { eventId: string } }
  | { type: "SAVE_DECISION"; payload: DecisionPayload; detectedEvent?: DetectedEvent }
  | { type: "GET_PENDING_EVENT" }
  | { type: "PENDING_EVENT_RESPONSE"; payload: DetectedEvent | null }
  | { type: "DECISION_SAVED_OK"; payload: { decisionId: string } }
  | { type: "DECISION_SAVE_ERROR"; payload: { message: string } }
  | { type: "SYNC_QUEUE_STATUS"; payload: { queued: number } }
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

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiEventResponse {
  id: string
  client_id: number
  source_app: string
  event_type: string
  source_url: string | null
  external_entity_id: string | null
  title: string | null
  description: string | null
  occurred_at: string
  created_at: string
}

export interface ApiDecisionResponse {
  id: string
  client_id: number
  status: DecisionStatus
  decision_type: string
  context_category: string
  summary: string
  urgency: "NORMAL" | "HIGH" | "CRITICAL"
  recommended_action: "APPROVE" | "REJECT" | "ESCALATE" | null
  recommended_confidence: "HIGH" | "MEDIUM" | "LOW" | null
  suggested_conditions: string[]
  final_action: string | null
  decided_by: number | null
  decided_at: string | null
  created_at: string
  recommendation: DecisionRecommendation | null
  subject_company: {
    id: number
    external_id: string
    name: string
    domain: string | null
  } | null
}

export interface ApiDecisionListResponse {
  data: ApiDecisionResponse[]
  total: number
  page: number
  limit: number
}

export interface ApiDecisionNote {
  id: string
  decision_id: string
  author_id: number
  content: string
  source_app: string | null
  source_url: string | null
  created_at: string
}

// ─── What syncDecisionNow returns ─────────────────────────────────────────────

export interface SyncResult {
  decisionId: string
  recommendation: DecisionRecommendation | null
  status: DecisionStatus
}
