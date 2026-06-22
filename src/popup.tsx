import React, { useEffect, useState } from "react"
import "./style.css"
import { SignInPrompt } from "~components/SignInPrompt"
import { Badge } from "~components/ui/Badge"
import { Button } from "~components/ui/Button"
import { Input } from "~components/ui/Input"
import { WEBAPP_URL } from "~lib/constants"
import { getSettings, getPendingQueueCount, saveSettings } from "~lib/storage"
import { useAuth } from "~hooks/useAuth"
import type { ExtensionSettings, SourceApp } from "~types"

function Popup() {
  const { isAuthenticated, user, displayName, memberships, loading } = useAuth()
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [apiUrl, setApiUrl] = useState("")
  const [queueCount, setQueueCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setApiUrl(s.apiUrl)
    })
    getPendingQueueCount().then(setQueueCount)
  }, [])

  async function handleSaveSettings() {
    await saveSettings({ apiUrl })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function toggleEnabled() {
    if (!settings) return
    const next = !settings.enabled
    await saveSettings({ enabled: next })
    setSettings((s) => (s ? { ...s, enabled: next } : s))
  }

  async function toggleSite(site: SourceApp) {
    if (!settings) return
    const updated = { ...settings.enabledSites, [site]: !settings.enabledSites[site] }
    await saveSettings({ enabledSites: updated })
    setSettings((s) => (s ? { ...s, enabledSites: updated } : s))
  }

  // Only block on auth loading — settings have a safe default so they never hang
  if (loading) {
    return (
      <div className="w-72 flex items-center justify-center py-10">
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-sm font-bold text-gray-900">ContextGrade</span>
        <div className="ml-auto">
          <button
            onClick={toggleEnabled}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              settings.enabled ? "bg-indigo-600" : "bg-gray-200"
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
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-indigo-700">
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

        {/* Site toggles */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Monitored apps
          </p>
          {(["jira", "figma", "hubspot"] as SourceApp[]).map((site) => (
            <div key={site} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-gray-700 capitalize">{site}</span>
              <button
                onClick={() => toggleSite(site)}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  settings.enabledSites[site] ? "bg-indigo-600" : "bg-gray-200"
                }`}>
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                    settings.enabledSites[site] ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Advanced settings */}
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <svg
              className={`w-3 h-3 transition-transform ${settingsOpen ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Advanced
          </button>

          {settingsOpen && (
            <div className="flex flex-col gap-3 mt-3">
              <Input
                label="API URL"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:3000/api"
              />
              <Button size="sm" onClick={handleSaveSettings}>
                {saved ? "Saved!" : "Save"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Popup
