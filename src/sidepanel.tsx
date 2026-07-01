import React, { useEffect, useState } from "react"
import logoWhite from "../assets/logos/context-grade-logo-white.svg"
import "./style.css"
import { DecisionForm } from "~components/DecisionForm"
import { FirstRunDisclosure } from "~components/FirstRunDisclosure"
import { SignInPrompt } from "~components/SignInPrompt"
import { Badge } from "~components/ui/Badge"
import { Button } from "~components/ui/Button"
import { useAuth } from "~hooks/useAuth"
import { usePendingEvent, useSavedDecision } from "~hooks/useDecision"
import { getTrackedSources, matchSource } from "~hooks/useTrackedSource"
import { generateId, detectSiteFromUrl } from "~lib/utils"
import {
  getDisclosureAcknowledged,
  setDisclosureAcknowledged
} from "~lib/storage"
import type { DetectedEvent } from "~types"

function SidePanel() {
  const { isAuthenticated, activeClientId, loading } = useAuth()
  const { pendingEvent, clearPending } = usePendingEvent()
  const { saved, markSaved, reset } = useSavedDecision()
  const [manualEvent, setManualEvent] = useState<DetectedEvent | null>(null)
  const [manualError, setManualError] = useState("")
  const [resolvingManual, setResolvingManual] = useState(false)
  const [disclosureAcknowledged, setDisclosureAcknowledgedState] = useState<boolean | null>(null)

  useEffect(() => {
    getDisclosureAcknowledged().then(setDisclosureAcknowledgedState)
  }, [])

  async function startManualEntry() {
    if (!activeClientId) return
    setResolvingManual(true)
    setManualError("")

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url ?? ""

    let hostname = ""
    try { hostname = new URL(url).hostname } catch {}

    const sources = await getTrackedSources(activeClientId).catch(() => [])
    const matched = matchSource(hostname, sources)

    setResolvingManual(false)

    if (!matched) {
      setManualError(
        `${hostname || "This site"} isn't registered as a tracked source. Add it from the ContextGrade dashboard first.`
      )
      return
    }

    const event: DetectedEvent = {
      id: generateId(),
      site: detectSiteFromUrl(url),
      eventType: "manual_entry",
      sourceUrl: url,
      title: tab?.title ?? undefined,
      occurredAt: new Date().toISOString(),
      sourceCompanyExternalId: matched.external_id,
      sourceCompanyName: matched.name
    }
    setManualEvent(event)
  }

  function cancelManual() {
    setManualEvent(null)
    setManualError("")
  }

  // Manual entry takes priority over storage-based pending event
  const activeEvent = manualEvent ?? pendingEvent

  if (loading || disclosureAcknowledged === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!disclosureAcknowledged) {
    return (
      <div className="flex flex-col h-full font-sans">
        <FirstRunDisclosure
          onAcknowledge={async () => {
            await setDisclosureAcknowledged()
            setDisclosureAcknowledgedState(true)
          }}
        />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full overflow-hidden font-sans">
        <SidePanelHeader />
        <SignInPrompt compact />
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex flex-col h-full overflow-hidden font-sans">
        <SidePanelHeader onAdd={startManualEntry} />
        <ManualErrorBanner message={manualError} />
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Decision saved</p>
            <p className="text-xs text-gray-500 mt-1">
              Reasoning recorded and synced to ContextGrade.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={reset}>
            Log another
          </Button>
        </div>
      </div>
    )
  }

  if (activeEvent) {
    return (
      <div className="flex flex-col h-full overflow-hidden font-sans">
        <SidePanelHeader
          pendingCount={!manualEvent && pendingEvent ? 1 : undefined}
          onAdd={startManualEntry}
        />
        <ManualErrorBanner message={manualError} />
        <div className="flex-1 overflow-y-auto p-4">
          <DecisionForm
            event={activeEvent}
            clientId={activeClientId ?? 0}
            onSuccess={(id) => {
              setManualEvent(null)
              if (!manualEvent) clearPending()
              markSaved(id)
            }}
            onCancel={() => {
              if (manualEvent) {
                cancelManual()
              } else {
                clearPending()
              }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
      <SidePanelHeader onAdd={startManualEntry} />
      <ManualErrorBanner message={manualError} />
      <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-accent-50 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-accent-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">No decision detected yet</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Navigate to a tracked site and take a meaningful action, or log one manually.
          </p>
        </div>
        <Button size="sm" loading={resolvingManual} onClick={startManualEntry}>
          Log a decision
        </Button>
      </div>
    </div>
  )
}

function ManualErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
      <p className="text-xs text-amber-700">{message}</p>
    </div>
  )
}

function SidePanelHeader({
  pendingCount,
  onAdd
}: {
  pendingCount?: number
  onAdd?: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
      <div className="w-6 h-6 rounded-lg bg-accent-600 flex items-center justify-center flex-shrink-0">
        <img src={logoWhite} alt="" className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm font-semibold text-gray-900">ContextGrade</span>
      <div className="ml-auto flex items-center gap-3">
        {pendingCount ? <Badge color="accent">Decision detected</Badge> : null}
        {onAdd ? (
          <button
            onClick={onAdd}
            title="Log a decision manually"
            className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700 transition-colors">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Log
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default SidePanel
