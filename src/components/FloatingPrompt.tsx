import React, { useEffect, useState } from "react"
import { sendToBackground } from "~lib/messaging"
import { labelFromEventType, truncate } from "~lib/utils"
import type { DetectedEvent } from "~types"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"

const SITE_COLORS: Record<string, "accent" | "green" | "amber"> = {
  jira: "accent",
  figma: "green",
  hubspot: "amber"
}

const SITE_LABELS: Record<string, string> = {
  jira: "Jira",
  figma: "Figma",
  hubspot: "HubSpot"
}

interface FloatingPromptProps {
  event: DetectedEvent
  onDismiss: () => void
  onSaved?: () => void
}

export function FloatingPrompt({ event, onDismiss, onSaved }: FloatingPromptProps) {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Auto-dismiss after 12 s if user ignores it
  useEffect(() => {
    const t = setTimeout(handleDismiss, 12_000)
    return () => clearTimeout(t)
  }, [])

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 300)
    sendToBackground({ type: "DISMISS_PROMPT", payload: { eventId: event.id } })
  }

  async function handleSave() {
    setSaving(true)
    await sendToBackground({ type: "OPEN_SIDE_PANEL", payload: event })
    setSaving(false)
    setVisible(false)
    setTimeout(() => { onDismiss(); onSaved?.() }, 300)
  }

  const siteColor = SITE_COLORS[event.site] ?? "accent"
  const siteLabel = SITE_LABELS[event.site] ?? event.site
  const eventLabel = labelFromEventType(event.eventType)

  return (
    <div
      className={`fixed bottom-[22%] right-6 z-[2147483647] font-sans transition-all duration-300 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-panel w-80 overflow-hidden">
        {/* Header stripe */}
        <div className="h-1 bg-gradient-accent" />

        <div className="p-4">
          {/* Site + event label */}
          <div className="flex items-center gap-2 mb-3">
            <Badge color={siteColor}>{siteLabel}</Badge>
            <span className="text-xs text-gray-400">{eventLabel}</span>
          </div>

          {/* Event title */}
          <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">
            Decision detected
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            {truncate(event.title ?? event.description ?? "A meaningful action occurred.", 80)}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4">
            <Button size="sm" loading={saving} onClick={handleSave} className="flex-1">
              Save reasoning
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
