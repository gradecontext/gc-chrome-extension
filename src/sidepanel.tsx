import React from "react"
import "./style.css"
import { DecisionForm } from "~components/DecisionForm"
import { SignInPrompt } from "~components/SignInPrompt"
import { Badge } from "~components/ui/Badge"
import { Button } from "~components/ui/Button"
import { useAuth } from "~hooks/useAuth"
import { usePendingEvent, useSavedDecision } from "~hooks/useDecision"

function SidePanel() {
  const { isAuthenticated, loading } = useAuth()
  const { pendingEvent, clearPending } = usePendingEvent()
  const { saved, markSaved, reset } = useSavedDecision()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
        <SidePanelHeader />
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

  if (!pendingEvent) {
    return (
      <div className="flex flex-col h-full overflow-hidden font-sans">
        <SidePanelHeader />
        <div className="flex flex-col items-center justify-center flex-1 gap-3 p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-400"
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
              Navigate to Jira, Figma, or HubSpot and take a meaningful action.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
      <SidePanelHeader pendingCount={1} />
      <div className="flex-1 overflow-y-auto p-4">
        <DecisionForm
          event={pendingEvent}
          onSuccess={(id) => markSaved(id)}
          onCancel={() => clearPending()}
        />
      </div>
    </div>
  )
}

function SidePanelHeader({ pendingCount }: { pendingCount?: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
      <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
        <svg
          className="w-3.5 h-3.5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-sm font-semibold text-gray-900">ContextGrade</span>
      {pendingCount ? (
        <span className="ml-auto">
          <Badge color="indigo">Decision detected</Badge>
        </span>
      ) : null}
    </div>
  )
}

export default SidePanel
