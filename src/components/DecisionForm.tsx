import React, { useEffect, useState } from "react"
import { sendToBackground } from "~lib/messaging"
import { getContextCategories, getDecisionTypes, reviewDecision } from "~services/api"
import type {
  ContextCategory,
  DecisionPayload,
  DecisionRecommendation,
  DecisionTypeOption,
  DetectedEvent,
  ReviewAction
} from "~types"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Textarea } from "./ui/Textarea"

const SITE_LABEL: Record<string, string> = {
  figma: "Figma",
  jira: "Jira",
  hubspot: "HubSpot"
}

const SITE_COLOR: Record<string, "green" | "indigo" | "amber"> = {
  figma: "green",
  jira: "indigo",
  hubspot: "amber"
}

interface DecisionFormProps {
  event: DetectedEvent
  clientId: number
  onSuccess: (decisionId: string) => void
  onCancel: () => void
}

export function DecisionForm({ event, clientId, onSuccess, onCancel }: DecisionFormProps) {
  const [step, setStep] = useState<"form" | "recommendation">("form")

  // Form fields
  const [contextCategories, setContextCategories] = useState<ContextCategory[]>([])
  const [contextCategory, setContextCategory] = useState("")
  const [decisionTypes, setDecisionTypes] = useState<DecisionTypeOption[]>([])
  const [decisionType, setDecisionType] = useState("")
  const [decision, setDecision] = useState("")
  const [rationale, setRationale] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Recommendation step
  const [decisionId, setDecisionId] = useState("")
  const [recommendation, setRecommendation] = useState<DecisionRecommendation | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState("")

  useEffect(() => {
    getContextCategories(clientId).then(setContextCategories).catch(() => {})

    getDecisionTypes(clientId)
      .then((types) => {
        setDecisionTypes(types)

        const type = event.eventType.toLowerCase()
        const guess =
          (type.includes("discount") && "DISCOUNT") ||
          (type.includes("onboard") && "ONBOARDING") ||
          (type.includes("renewal") && "RENEWAL") ||
          (type.includes("escalat") && "ESCALATION") ||
          (type.includes("partner") && "PARTNERSHIP") ||
          (type.includes("payment") && "PAYMENT_TERMS") ||
          ""

        const active = types.filter((t) => t.active)
        const match =
          active.find((t) => t.decision_type === guess) ??
          active.find((t) => t.decision_type === "CUSTOM")
        if (match) setDecisionType(match.decision_type)
      })
      .catch(() => {})
  }, [clientId, event.eventType])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!decision.trim()) {
      setFormError("Describe what was decided.")
      return
    }
    if (!rationale.trim()) {
      setFormError("Add the reasoning — this is what makes the record valuable later.")
      return
    }
    if (!contextCategory) {
      setFormError("Select a context category.")
      return
    }
    if (!decisionType) {
      setFormError("Select a decision type.")
      return
    }
    if (!event.sourceCompanyExternalId) {
      setFormError("This site isn't registered as a tracked source. Add it from the ContextGrade dashboard first.")
      return
    }

    setSaving(true)
    setFormError("")

    const payload: DecisionPayload = {
      decisionType,
      contextCategory,
      summary: decision.trim(),
      // Note content: decision title + why — sent inline in POST /decisions
      rationale: `${decision.trim()}\n\nWhy: ${rationale.trim()}`,
      externalId: event.sourceCompanyExternalId,
      sourceApp: event.site,
      sourceUrl: event.sourceUrl,
      externalEntityId: event.externalEntityId,
      occurredAt: event.occurredAt
    }

    const response = await sendToBackground({
      type: "SAVE_DECISION",
      payload,
      detectedEvent: event
    }) as {
      decisionId?: string
      recommendation?: DecisionRecommendation
      status?: string
      queued?: boolean
      error?: string
    } | undefined

    console.log("[CG:form] SAVE_DECISION response:", response)

    setSaving(false)

    if (response?.error === "NOT_AUTHENTICATED") {
      setFormError("Session expired — please sign in again via the extension popup.")
      return
    }
    if (response?.error) {
      setFormError(response.error)
      return
    }
    if (!response?.decisionId) {
      setFormError("Unexpected response. Please try again.")
      return
    }

    if (response.queued || !response.recommendation) {
      onSuccess(response.decisionId)
      return
    }

    setDecisionId(response.decisionId)
    setRecommendation(response.recommendation)
    setStep("recommendation")
  }

  async function handleReview(action: ReviewAction) {
    setReviewing(true)
    setReviewError("")
    try {
      await reviewDecision(decisionId, action, clientId, reviewNote.trim() || undefined)
      onSuccess(decisionId)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Review failed. Please try again.")
      setReviewing(false)
    }
  }

  // ── Recommendation step ───────────────────────────────────────────────────────

  if (step === "recommendation" && recommendation) {
    const rec = recommendation.recommendation
    const conf = recommendation.confidence

    return (
      <div className="flex flex-col gap-4">
        <SourceRow event={event} />

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              AI Recommendation
            </span>
            <span className="ml-auto text-xs text-gray-400 capitalize">{conf} confidence</span>
          </div>
          <div className="p-3 flex flex-col gap-3">
            <Badge color={rec === "APPROVE" ? "green" : rec === "REJECT" ? "red" : "amber"}>
              {rec}
            </Badge>

            {recommendation.rationale.length > 0 && (
              <ul className="flex flex-col gap-1">
                {recommendation.rationale.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-0.5 text-gray-300">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}

            {recommendation.suggested_conditions.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-xs font-medium text-amber-700 mb-1">Suggested conditions</p>
                <ul className="flex flex-col gap-0.5">
                  {recommendation.suggested_conditions.map((c, i) => (
                    <li key={i} className="text-xs text-amber-600">— {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <Textarea
          label="Add a note (optional)"
          hint="Your reasoning will be recorded alongside the decision."
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          placeholder="Any additional context before marking your review…"
          rows={3}
        />

        {reviewError && <p className="text-xs text-red-500 font-medium">{reviewError}</p>}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button className="flex-1" loading={reviewing} onClick={() => handleReview("approve")}>
              Approve
            </Button>
            <Button variant="ghost" loading={reviewing} onClick={() => handleReview("reject")}>
              Reject
            </Button>
            <Button variant="ghost" loading={reviewing} onClick={() => handleReview("escalate")}>
              Escalate
            </Button>
          </div>
          <button
            type="button"
            onClick={() => onSuccess(decisionId)}
            className="text-xs text-gray-400 hover:text-gray-600 text-center transition-colors">
            Skip review for now
          </button>
        </div>
      </div>
    )
  }

  // ── Capture form ──────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SourceRow event={event} />

      {/* Context category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Context category</label>
        <select
          value={contextCategory}
          onChange={(e) => setContextCategory(e.target.value)}
          required
          className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
          <option value="" disabled>
            Select a category…
          </option>
          {contextCategories
            .filter((c) => c.active)
            .map((c) => (
              <option key={c.id} value={c.category}>
                {c.label || c.category}
              </option>
            ))}
        </select>
      </div>

      {/* Decision type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Decision type</label>
        <select
          value={decisionType}
          onChange={(e) => setDecisionType(e.target.value)}
          required
          className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
          <option value="" disabled>
            Select a type…
          </option>
          {decisionTypes
            .filter((dt) => dt.active)
            .map((dt) => (
              <option key={dt.id} value={dt.decision_type}>
                {dt.label || dt.decision_type}
              </option>
            ))}
        </select>
      </div>

      {/* Decision — what was decided */}
      <Textarea
        label="Decision"
        value={decision}
        onChange={(e) => setDecision(e.target.value)}
        placeholder="What was decided?"
        rows={2}
      />

      {/* Rationale — the why */}
      <Textarea
        label="Why"
        hint="What context won't be obvious when someone reads this later?"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="What drove this decision? What trade-offs or constraints mattered?"
        rows={4}
      />

      {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={saving} className="flex-1">
          Capture decision
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function SourceRow({ event }: { event: DetectedEvent }) {
  const label = event.sourceCompanyName ?? SITE_LABEL[event.site] ?? event.site
  const color = SITE_COLOR[event.site] ?? "gray"

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-xl">
      <span className="text-xs text-gray-400 w-12 flex-shrink-0">Source</span>
      <Badge color={color}>{label}</Badge>
      {event.sourceCompanyExternalId && (
        <span className="text-xs text-gray-400 truncate ml-auto font-mono">
          {event.sourceCompanyExternalId}
        </span>
      )}
    </div>
  )
}
