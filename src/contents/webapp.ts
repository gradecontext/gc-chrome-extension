import type { PlasmoCSConfig } from "plasmo"
import type { SupabaseRawSession } from "~types"
import { isChromeContextValid } from "~lib/utils"

export const config: PlasmoCSConfig = {
  matches: [
    "http://localhost:3000/*",
    "https://app.contextgrade.com/*"
  ],
  all_frames: false,
  run_at: "document_start"
}

const log = (...args: unknown[]) => console.log("[CG:webapp]", ...args)

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

let sessionWritten = false

function storeSession(session: SupabaseRawSession, source: string) {
  if (sessionWritten) return
  if (!isChromeContextValid()) return
  sessionWritten = true

  log(`storing raw session (source: ${source}) expires:`, new Date(session.expires_at * 1000).toISOString())

  try {
    const cr = (globalThis as any).chrome
    cr.storage.local.set({ [RAW_SESSION_KEY]: session }, () => {
      try {
        if (cr.runtime.lastError) {
          log("chrome.storage.local.set failed:", cr.runtime.lastError.message)
          sessionWritten = false
        } else {
          log("raw session written to storage — background will pick it up via onChanged")
        }
      } catch {
        // lastError access itself can throw after invalidation
        sessionWritten = false
      }
    })
  } catch (e) {
    log("storeSession threw (context likely invalidated):", e)
    sessionWritten = false
  }
}

function clearSession() {
  sessionWritten = false
  if (!isChromeContextValid()) return
  try {
    ;(globalThis as any).chrome.storage.local.remove(RAW_SESSION_KEY)
  } catch {
    // context invalidated — nothing to do
  }
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

window.addEventListener("cg:auth", (e: Event) => {
  const detail = (e as CustomEvent<unknown>).detail
  log("received cg:auth CustomEvent")
  const session = parseSession(detail)
  if (session) storeSession(session, "cg:auth-event")
})

window.addEventListener("cg:signout", () => {
  log("received cg:signout — clearing raw session")
  clearSession()
})

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
  let polls = 0
  const poll = setInterval(() => {
    if (!isChromeContextValid() || ++polls > 20 || sessionWritten) {
      clearInterval(poll)
      return
    }
    const s = scanLocalStorage()
    if (s) { clearInterval(poll); storeSession(s, `poll-${polls}`) }
  }, 800)
}

export {}
