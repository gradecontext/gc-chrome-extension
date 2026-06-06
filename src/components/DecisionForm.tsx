import React, { useEffect, useState } from "react"
import { sendToBackground } from "~lib/messaging"
import { labelFromEventType } from "~lib/utils"
import type { DecisionPayload, DecisionType, DetectedEvent } from "~types"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Input } from "./ui/Input"
import { Textarea } from "./ui/Textarea"

const DECISION_TYPES: { value: DecisionType; label: string }[] = [
  { value: "CUSTOM", label: "General Decision" },
  { value: "DISCOUNT", label: "Discount Approval" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "PAYMENT_TERMS", label: "Payment Terms" },
  { value: "RENEWAL", label: "Renewal" },
  { value: "ESCALATION", label: "Escalation" },
  { value: "PARTNERSHIP", label: "Partnership" }
]

interface DecisionFormProps {
  event: DetectedEvent
  onSuccess: (decisionId: string) => void
  onCancel: () => void
}

export function DecisionForm({ event, onSuccess, onCancel }: DecisionFormProps) {
  const [summary, setSummary] = useState(event.title ?? "")
  const [rationale, setRationale] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [decisionType, setDecisionType] = useState<DecisionType>("CUSTOM")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Pre-select decision type from event hint
  useEffect(() => {
    const type = event.eventType.toLowerCase()
    if (type.includes("discount")) setDecisionType("DISCOUNT")
    else if (type.includes("onboard")) setDecisionType("ONBOARDING")
    else if (type.includes("renewal")) setDecisionType("RENEWAL")
    else if (type.includes("escalat")) setDecisionType("ESCALATION")
  }, [event.eventType])

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput("")
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag()
    }
    if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) {
      setError("Summary is required")
      return
    }

    setSaving(true)
    setError("")

    const payload: DecisionPayload = {
      observedEventClientId: event.id,
      summary: summary.trim(),
      rationale: rationale.trim() || undefined,
      tags,
      decisionType,
      sourceApp: event.site,
      sourceUrl: event.sourceUrl,
      externalEntityId: event.externalEntityId,
      occurredAt: event.occurredAt
    }

    const response = await sendToBackground({
      type: "SAVE_DECISION",
      payload
    }) as { decisionId?: string; error?: string } | undefined

    setSaving(false)

    if (response?.error === "NOT_AUTHENTICATED") {
      setError("Session expired — please sign in again via the extension popup.")
    } else if (response?.error) {
      setError(response.error)
    } else if (response?.decisionId) {
      onSuccess(response.decisionId)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Context pill */}
      <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-xl">
        <Badge color={event.site === "jira" ? "indigo" : event.site === "figma" ? "green" : "amber"}>
          {event.site.charAt(0).toUpperCase() + event.site.slice(1)}
        </Badge>
        <span className="text-xs text-gray-500 truncate">{labelFromEventType(event.eventType)}</span>
        {event.externalEntityId && (
          <span className="text-xs text-gray-400 ml-auto font-mono">
            {event.externalEntityId}
          </span>
        )}
      </div>

      {/* Summary */}
      <Input
        label="Decision summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What was decided?"
        required
      />

      {/* Decision type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Decision type</label>
        <select
          value={decisionType}
          onChange={(e) => setDecisionType(e.target.value as DecisionType)}
          className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
          {DECISION_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>
              {dt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Rationale */}
      <Textarea
        label="Rationale (optional)"
        hint="Why was this decision made? Add context that won't be obvious later."
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="The customer had escalated twice and we needed to move quickly…"
        rows={4}
      />

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Tags</label>
        <div className="flex flex-wrap gap-1.5 p-2 min-h-[40px] rounded-lg border border-gray-200 bg-white">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-indigo-400 hover:text-indigo-700 leading-none">
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={addTag}
            placeholder={tags.length === 0 ? "Add tags…" : ""}
            className="flex-1 min-w-[80px] text-xs outline-none bg-transparent placeholder:text-gray-400"
          />
        </div>
        <p className="text-xs text-gray-400">Press Enter or comma to add</p>
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={saving} className="flex-1">
          Save decision
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
