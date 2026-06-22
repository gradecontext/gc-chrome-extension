import { STORAGE_KEYS, SYNC_INTERVAL_MS } from "~lib/constants"
import { onMessage } from "~lib/messaging"
import { clearAuthState, getPendingEvent, setPendingEvent } from "~lib/storage"
import { getAuthState, signOut, validateAndStoreSession } from "~services/auth"
import { enqueueDecision } from "~services/cache"
import { flushSyncQueue, syncDecisionNow } from "~services/sync"
import type { ExtensionMessage, SupabaseRawSession } from "~types"

const log = (...args: unknown[]) => console.debug("[CG:bg]", ...args)
const err = (...args: unknown[]) => console.error("[CG:bg]", ...args)

// ─── Auth: react to raw session written by content script ─────────────────────
// The webapp content script writes cg_raw_session directly to chrome.storage.
// This listener wakes the service worker via the storage event (more reliable
// than runtime.sendMessage which can time out if the SW is idle).

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEYS.RAW_SESSION]) return

  const session = changes[STORAGE_KEYS.RAW_SESSION].newValue as SupabaseRawSession | undefined
  if (!session?.access_token) return

  log("raw session detected via storage.onChanged — validating with API...")

  validateAndStoreSession(session)
    .then((authState) => {
      if (authState) {
        log("session valid — user:", authState.user.email, "clientId:", authState.activeClientId)
      } else {
        log("session validation FAILED — API returned null (check token or /api/v1/users/me endpoint)")
      }
      // Always clear the raw session — auth state (or null) is now authoritative
      chrome.storage.local.remove(STORAGE_KEYS.RAW_SESSION)
    })
    .catch((e) => {
      err("validateAndStoreSession threw:", e)
      chrome.storage.local.remove(STORAGE_KEYS.RAW_SESSION)
    })
})

// ─── Periodic sync alarm ──────────────────────────────────────────────────────

chrome.alarms.create("cg-sync", { periodInMinutes: SYNC_INTERVAL_MS / 60_000 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cg-sync") {
    log("sync alarm fired")
    flushSyncQueue().catch((e) => err("flush failed", e))
  }
})

// ─── Message handler ──────────────────────────────────────────────────────────

onMessage((message: ExtensionMessage, sender, sendResponse) => {
  log("message received:", message.type)

  switch (message.type) {
    // ── Auth ──────────────────────────────────────────────────────────────────

    case "WEBAPP_SESSION": {
      log("validating session from webapp tab", sender.tab?.url)
      validateAndStoreSession(message.payload)
        .then((authState) => {
          if (authState) {
            log("session valid — user:", authState.user.email, "clientId:", authState.activeClientId)
          } else {
            log("session validation failed (API returned no user)")
          }
          sendResponse({ ok: !!authState, user: authState?.user ?? null })
        })
        .catch((e) => {
          err("session validation threw", e)
          sendResponse({ ok: false })
        })
      return true
    }

    case "GET_AUTH_STATE": {
      getAuthState()
        .then((state) => {
          log("GET_AUTH_STATE →", state ? state.user.email : "null")
          sendResponse({ payload: state })
        })
        .catch(() => sendResponse({ payload: null }))
      return true
    }

    case "SIGN_OUT": {
      signOut()
        .then(() => { log("signed out"); sendResponse({ ok: true }) })
        .catch(() => sendResponse({ ok: false }))
      return true
    }

    // ── Events & decisions ────────────────────────────────────────────────────

    case "DECISION_DETECTED": {
      log("event detected:", message.payload.eventType, "on", message.payload.site)
      setPendingEvent(message.payload).catch((e) => err("setPendingEvent failed", e))
      sendResponse({ ok: true })
      break
    }

    case "OPEN_SIDE_PANEL": {
      log("opening side panel for tab", sender.tab?.id)
      setPendingEvent(message.payload)
        .then(() => {
          const tabId = sender.tab?.id
          if (tabId != null) return chrome.sidePanel.open({ tabId })
        })
        .catch((e) => err("open side panel failed", e))
      sendResponse({ ok: true })
      break
    }

    case "OPEN_PANEL": {
      log("opening side panel (no event) for tab", sender.tab?.id)
      const tabId = sender.tab?.id
      if (tabId != null) {
        chrome.sidePanel.open({ tabId }).catch((e) => err("open panel failed", e))
      }
      sendResponse({ ok: true })
      break
    }

    case "DISMISS_PROMPT": {
      log("prompt dismissed for event", message.payload.eventId)
      sendResponse({ ok: true })
      break
    }

    case "GET_PENDING_EVENT": {
      getPendingEvent()
        .then((event) => {
          log("GET_PENDING_EVENT →", event?.eventType ?? "null")
          sendResponse({ payload: event })
        })
        .catch(() => sendResponse({ payload: null }))
      return true
    }

    case "SAVE_DECISION": {
      const { payload, detectedEvent: messageEvent } = message
      log("saving decision:", payload.decisionType, "on", payload.sourceApp)

      Promise.all([getAuthState(), getPendingEvent()])
        .then(async ([auth, storedEvent]) => {
          if (!auth) {
            log("SAVE_DECISION — not authenticated")
            sendResponse({ error: "NOT_AUTHENTICATED" })
            return
          }

          // Prefer event passed in the message (manual entries), fall back to storage
          const eventToSync = messageEvent ?? storedEvent

          if (eventToSync) {
            log("syncing to API — event:", eventToSync.eventType, "url:", eventToSync.sourceUrl)
            try {
              const result = await syncDecisionNow(eventToSync, payload)
              log("decision synced — id:", result.decisionId, "status:", result.status)
              if (storedEvent) await setPendingEvent(null)
              sendResponse({
                decisionId: result.decisionId,
                recommendation: result.recommendation,
                status: result.status
              })
            } catch (e) {
              err("sync failed:", e instanceof Error ? e.message : e)
              if (e instanceof Error && e.message === "UNAUTHORIZED") {
                await clearAuthState()
                sendResponse({ error: "NOT_AUTHENTICATED" })
              } else {
                const cached = await enqueueDecision(payload)
                if (storedEvent) await setPendingEvent(null)
                log("queued for retry — id:", cached.id)
                sendResponse({ decisionId: cached.id, queued: true, error: String(e) })
              }
            }
          } else {
            log("no event context — queuing")
            const cached = await enqueueDecision(payload)
            sendResponse({ decisionId: cached.id, queued: true })
          }
        })
        .catch((e) => { err("SAVE_DECISION threw:", e); sendResponse({ error: String(e) }) })

      return true
    }

    default:
      // Always respond so callers don't hang
      sendResponse({ ok: false, error: "unknown message type" })
  }
})

// ─── Install ──────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  log("extension installed/updated")
})

export {}
