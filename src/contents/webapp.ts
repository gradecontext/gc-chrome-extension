import type { PlasmoCSConfig } from "plasmo"
import type { SupabaseRawSession } from "~types"

export const config: PlasmoCSConfig = {
  matches: [
    "http://localhost:3000/*",
    "https://app.contextgrade.com/*"
  ],
  all_frames: false,
  run_at: "document_start"
}

const log = (...args: unknown[]) => console.log("[CG:webapp]", ...args)

// ─── Storage key (must match STORAGE_KEYS.RAW_SESSION in constants.ts) ────────
const RAW_SESSION_KEY = "cg_raw_session"

// ─── Session parsing ──────────────────────────────────────────────────────────

function parseSession(raw: unknown): SupabaseRawSession | null {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw
    const s = (obj as any)?.session ?? obj
    if (
      typeof s?.access_token === "string" &&
      typeof s?.refresh_token === "string" &&
      typeof s?.expires_at === "number"
    ) {
      return {
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: s.expires_at,
        token_type: s.token_type ?? "bearer"
      }
    }
    return null
  } catch {
    return null
  }
}

function isAuthKey(key: string | null): boolean {
  if (!key) return false
  return key === "cg_auth_signal" ||
    (key.startsWith("sb-") && key.endsWith("-auth-token"))
}

// ─── Write session directly to chrome.storage.local ──────────────────────────
// Bypasses chrome.runtime.sendMessage entirely — no service worker connection
// needed. The background listens via chrome.storage.onChanged and validates.

let sessionWritten = false

function storeSession(session: SupabaseRawSession, source: string) {
  if (sessionWritten) return
  sessionWritten = true

  log(`storing raw session (source: ${source}) expires:`, new Date(session.expires_at * 1000).toISOString())

  chrome.storage.local.set({ [RAW_SESSION_KEY]: session }, () => {
    if (chrome.runtime.lastError) {
      log("chrome.storage.local.set failed:", chrome.runtime.lastError.message)
      sessionWritten = false
    } else {
      log("raw session written to storage — background will pick it up via onChanged")
    }
  })
}

// ─── Scan localStorage for existing session ───────────────────────────────────

function scanLocalStorage(): SupabaseRawSession | null {
  log("scanning localStorage —", localStorage.length, "keys")
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!isAuthKey(key)) continue
    const raw = localStorage.getItem(key!)
    if (!raw) continue
    const session = parseSession(raw)
    if (session) {
      log(`found session in localStorage key "${key}"`)
      return session
    }
  }
  log("no session in localStorage")
  return null
}

// ─── Listeners ────────────────────────────────────────────────────────────────

// 1. CustomEvent from webapp's onAuthStateChange (same-tab, immediate)
window.addEventListener("cg:auth", (e: Event) => {
  const detail = (e as CustomEvent<unknown>).detail
  log("received cg:auth CustomEvent")
  const session = parseSession(detail)
  if (session) storeSession(session, "cg:auth-event")
})

window.addEventListener("cg:signout", () => {
  log("received cg:signout — clearing raw session")
  sessionWritten = false
  chrome.storage.local.remove(RAW_SESSION_KEY)
})

// 2. Cross-tab storage event (login in another tab)
window.addEventListener("storage", (e) => {
  if (!isAuthKey(e.key) || !e.newValue) return
  log(`cross-tab storage event for key "${e.key}"`)
  const session = parseSession(e.newValue)
  if (session) storeSession(session, "cross-tab-storage")
})

// ─── On load ──────────────────────────────────────────────────────────────────

log("content script loaded on:", window.location.href)

const existing = scanLocalStorage()
if (existing) {
  storeSession(existing, "initial-scan")
} else {
  // Short poll — catches onAuthStateChange firing just after document_start
  let polls = 0
  const poll = setInterval(() => {
    if (++polls > 20 || sessionWritten) return clearInterval(poll)
    const s = scanLocalStorage()
    if (s) { clearInterval(poll); storeSession(s, `poll-${polls}`) }
  }, 800)
}

export {}
