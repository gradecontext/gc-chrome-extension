export const STORAGE_KEYS = {
  SETTINGS: "cg_settings",
  SYNC_QUEUE: "cg_sync_queue",
  PENDING_EVENT: "cg_pending_event",
  AUTH_STATE: "cg_auth_state",
  // Raw session written by content script, consumed + cleared by background
  RAW_SESSION: "cg_raw_session",
  // Cached GET /decisions/subject-companies response, used to gate icon visibility
  SOURCES_CACHE: "cg_sources_cache",
  // Set once when the user acknowledges the first-run privacy disclosure
  DISCLOSURE_ACKNOWLEDGED: "cg_disclosure_ack"
} as const

export const DEFAULT_SETTINGS = {
  apiUrl: process.env.PLASMO_PUBLIC_API_URL ?? "http://localhost:3000/api",
  enabled: true
} as const

// How long the tracked-sources list is cached before re-fetching
export const SOURCES_CACHE_TTL_MS = 5 * 60_000 // 5 minutes

export const WEBAPP_URL =
  process.env.PLASMO_PUBLIC_WEBAPP_URL ?? "http://localhost:3000"

// Token is considered stale if it expires within this window
export const TOKEN_REFRESH_BUFFER_SECS = 300 // 5 minutes

export const MAX_SYNC_RETRIES = 3
export const SYNC_INTERVAL_MS = 30_000

// State transitions that qualify as "meaningful decisions"
export const MEANINGFUL_JIRA_STATUSES = new Set([
  "Done",
  "Closed",
  "Resolved",
  "Approved",
  "Rejected",
  "Won't Do"
])

export const MEANINGFUL_HUBSPOT_STAGES = new Set([
  "closedwon",
  "closedlost",
  "contractsent",
  "decisionmakerboughtin"
])
