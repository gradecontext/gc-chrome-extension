import { MEANINGFUL_JIRA_STATUSES } from "~lib/constants"
import { generateId, now } from "~lib/utils"
import type { DetectedEvent } from "~types"
import { BaseDetector } from "../detector"

// Tracks the last-seen status text to avoid duplicate fire for the same status
let lastSeenStatus = ""

export class JiraDetector extends BaseDetector {
  protected attach(): void {
    // Jira renders status badges in the issue view — we watch the whole body
    // because the badge can live at varying depths depending on Jira version.
    this.observe(document, () => this.checkStatusChange(), {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  private checkStatusChange(): void {
    // Jira Next-gen / Team-managed projects use [data-testid*="status"]
    // Jira Classic uses spans with class "status-view"
    const statusEl =
      document.querySelector('[data-testid*="status-summary"]') ??
      document.querySelector('[data-testid*="issue.views.field.status"]') ??
      document.querySelector(".status-view") ??
      document.querySelector('[class*="status-badge"]')

    if (!statusEl) return

    const statusText = statusEl.textContent?.trim() ?? ""
    if (!statusText || statusText === lastSeenStatus) return
    if (!MEANINGFUL_JIRA_STATUSES.has(statusText)) return

    lastSeenStatus = statusText

    const issueKey = this.extractIssueKey()
    const issueTitle = this.extractIssueTitle()

    const event: DetectedEvent = {
      id: generateId(),
      site: "jira",
      eventType: `JIRA_STATUS_${statusText.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
      sourceUrl: window.location.href,
      externalEntityId: issueKey ?? undefined,
      title: issueTitle
        ? `${issueKey}: ${issueTitle}`
        : `Issue moved to ${statusText}`,
      description: `Jira issue status changed to "${statusText}"`,
      rawData: { statusText, issueKey, issueTitle },
      occurredAt: now()
    }

    this.callback(event)
  }

  private extractIssueKey(): string | null {
    // URL pattern: /browse/PROJ-123  or  /issues/PROJ-123
    const match = window.location.pathname.match(/\/([A-Z]+-\d+)/)
    if (match) return match[1]

    // Breadcrumb in the page
    const breadcrumb = document.querySelector(
      '[data-testid*="issue.breadcrumb"] [class*="breadcrumb"]'
    )
    return breadcrumb?.textContent?.trim() ?? null
  }

  private extractIssueTitle(): string | null {
    const el =
      document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]') ??
      document.querySelector('h1[class*="summary"]') ??
      document.querySelector('[class*="issue-header-actions"] h1')

    return el?.textContent?.trim() ?? null
  }
}
