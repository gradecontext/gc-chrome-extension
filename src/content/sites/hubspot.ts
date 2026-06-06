import { MEANINGFUL_HUBSPOT_STAGES } from "~lib/constants"
import { generateId, now } from "~lib/utils"
import type { DetectedEvent } from "~types"
import { BaseDetector } from "../detector"

let lastSeenStage = ""

export class HubSpotDetector extends BaseDetector {
  protected attach(): void {
    // HubSpot CRM is a SPA — pipeline stage changes happen via DOM updates
    this.observe(document, () => this.checkDealStage(), {
      childList: true,
      subtree: true
    })
  }

  private checkDealStage(): void {
    // HubSpot renders the current deal stage in multiple places depending on view
    const stageEl =
      document.querySelector('[data-test-id="deal-stage-select"] [class*="selected"]') ??
      document.querySelector('[class*="deal-stage"] [class*="stage-name"]') ??
      document.querySelector('[aria-label*="Deal Stage"] [class*="value"]') ??
      // Pipeline header badge
      document.querySelector('[class*="pipeline-stage"][aria-current="true"]') ??
      document.querySelector('[class*="stage"][class*="active"] [class*="label"]')

    if (!stageEl) return

    const stageText = stageEl.textContent?.trim() ?? ""
    const stageSlug = stageText.toLowerCase().replace(/\s+/g, "")

    if (!stageText || stageText === lastSeenStage) return
    if (!this.isMeaningfulStage(stageSlug, stageText)) return

    lastSeenStage = stageText

    const dealId = this.extractDealId()
    const dealName = this.extractDealName()

    const event: DetectedEvent = {
      id: generateId(),
      site: "hubspot",
      eventType: `HUBSPOT_DEAL_STAGE_${stageSlug.toUpperCase()}`,
      sourceUrl: window.location.href,
      externalEntityId: dealId ?? undefined,
      title: dealName ? `Deal "${dealName}" → ${stageText}` : `Deal moved to ${stageText}`,
      description: `HubSpot deal stage changed to "${stageText}"`,
      rawData: { stageText, stageSlug, dealId, dealName },
      occurredAt: now()
    }

    this.callback(event)
  }

  private isMeaningfulStage(slug: string, label: string): boolean {
    // Check against known meaningful stage slugs
    if (MEANINGFUL_HUBSPOT_STAGES.has(slug)) return true

    // Also catch "Closed Won" / "Closed Lost" as display text variants
    const normalized = label.toLowerCase()
    return (
      normalized.includes("closed") ||
      normalized.includes("won") ||
      normalized.includes("lost") ||
      normalized.includes("contract sent") ||
      normalized.includes("decision maker")
    )
  }

  private extractDealId(): string | null {
    // HubSpot URL: /contacts/{portalId}/deal/{dealId}
    const match = window.location.pathname.match(/\/deal\/(\d+)/)
    return match?.[1] ?? null
  }

  private extractDealName(): string | null {
    const el =
      document.querySelector('[data-test-id="deal-name"]') ??
      document.querySelector('h1[class*="record-name"]') ??
      document.querySelector('[class*="record-header"] h1')

    return el?.textContent?.trim() ?? null
  }
}
