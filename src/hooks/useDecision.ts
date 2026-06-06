import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"
import { useState } from "react"
import { STORAGE_KEYS } from "~lib/constants"
import { setPendingEvent } from "~lib/storage"
import type { DetectedEvent } from "~types"

const localStore = new Storage({ area: "local" })

// Used inside the side panel to access and clear the pending detected event
export function usePendingEvent() {
  const [pendingEvent, , { setRenderValue, remove }] =
    useStorage<DetectedEvent | undefined>(
      { key: STORAGE_KEYS.PENDING_EVENT, instance: localStore },
      undefined
    )

  async function clearPending() {
    remove()
    setRenderValue(undefined)
    await setPendingEvent(null)
  }

  return { pendingEvent: pendingEvent ?? null, clearPending }
}

// Tracks the decision that was just saved (in-memory only — resets on panel close)
export function useSavedDecision() {
  const [saved, setSaved] = useState<{ decisionId: string; savedAt: string } | null>(null)

  function markSaved(decisionId: string) {
    setSaved({ decisionId, savedAt: new Date().toISOString() })
  }

  function reset() {
    setSaved(null)
  }

  return { saved, markSaved, reset }
}
