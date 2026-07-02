import React, { useEffect, useState } from "react"
import logoWhite from "../assets/logos/context-grade-logo-white.svg"
import "./style.css"
import { FirstRunDisclosure } from "~components/FirstRunDisclosure"
import { SignInPrompt } from "~components/SignInPrompt"
import { Badge } from "~components/ui/Badge"
import { useAuth } from "~hooks/useAuth"
import { getTrackedSources } from "~hooks/useTrackedSource"
import {
  getSettings,
  getPendingQueueCount,
  saveSettings,
  getDisclosureAcknowledged,
  setDisclosureAcknowledged,
  clearCachedSources
} from "~lib/storage"
import type { ExtensionSettings, SubjectCompanySource } from "~types"

function Popup() {
  const { isAuthenticated, user, displayName, memberships, activeClientId, loading } = useAuth()
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [queueCount, setQueueCount] = useState(0)
  const [sources, setSources] = useState<SubjectCompanySource[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [disclosureAcknowledged, setDisclosureAcknowledgedState] = useState<boolean | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    getPendingQueueCount().then(setQueueCount)
    getDisclosureAcknowledged().then(setDisclosureAcknowledgedState)
  }, [])

  useEffect(() => {
    if (!activeClientId) return
    getTrackedSources(activeClientId).then(setSources).catch(() => {})
  }, [activeClientId])

  async function handleRefresh() {
    if (!activeClientId || refreshing) return
    setRefreshing(true)
    await clearCachedSources()
    getTrackedSources(activeClientId)
      .then(setSources)
      .catch(() => {})
      .finally(() => setRefreshing(false))
  }

  async function toggleEnabled() {
    if (!settings) return
    const next = !settings.enabled
    await saveSettings({ enabled: next })
    setSettings((s) => (s ? { ...s, enabled: next } : s))
  }

  const activeSources = sources.filter((s) => s.active)

  // Only block on auth loading — settings have a safe default so they never hang
  if (loading || disclosureAcknowledged === null) {
    return (
      <div className="w-72 flex items-center justify-center py-10">
        <div className="w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!disclosureAcknowledged) {
    return (
      <div className="w-72 h-[480px] font-sans">
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
      <div className="w-72 font-sans">
        <SignInPrompt />
      </div>
    )
  }

  return (
    <div className="w-72 font-sans text-gray-900 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <div className="w-6 h-6 rounded-lg bg-accent-600 flex items-center justify-center flex-shrink-0">
          <img src={logoWhite} alt="" className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-bold text-gray-900">ContextGrade</span>
        <div className="ml-auto">
          <button
            onClick={toggleEnabled}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              settings.enabled ? "bg-accent-600" : "bg-gray-200"
            }`}>
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                settings.enabled ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* User info */}
        <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-accent-700">
              {(displayName ?? user?.email ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {displayName ?? user?.email}
            </p>
            {memberships[0] && (
              <p className="text-xs text-gray-400 truncate">{memberships[0].client.name}</p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge color={settings.enabled ? "green" : "gray"}>
            {settings.enabled ? "Active" : "Paused"}
          </Badge>
          {queueCount > 0 && (
            <Badge color="amber">{queueCount} pending sync</Badge>
          )}
        </div>

        {/* Tracked sites — admin-managed, read-only here */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Tracked sites
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh tracked sites"
              className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>
          {activeSources.length === 0 ? (
            <p className="text-xs text-gray-400">
              No sites registered yet. Add one from the ContextGrade dashboard.
            </p>
          ) : (
            activeSources.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700">{s.name}</span>
                <span className="text-xs text-gray-400 font-mono">{s.domain}</span>
              </div>
            ))
          )}
          <p className="text-xs text-gray-400 mt-1">
            Managed by your admin on the ContextGrade dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Popup
