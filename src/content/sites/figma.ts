import { generateId, now } from "~lib/utils"
import type { DetectedEvent } from "~types"
import { BaseDetector } from "../detector"

const log = (...args: unknown[]) => console.debug("[CG:figma]", ...args)

// Track resolved thread IDs so we don't fire duplicates across mutation batches
const seenResolutions = new Set<string>()

// Figma Design file: /file/, /proto/, /embed/
// FigJam board:      /board/, /whiteboard/
function isFigJam(): boolean {
  return /\/(board|whiteboard)\//.test(window.location.pathname)
}

export class FigmaDetector extends BaseDetector {
  protected attach(): void {
    const pageType = isFigJam() ? "FigJam board" : "Figma design file"
    log(`attached on ${pageType} — url:`, window.location.href)

    this.observe(document, (mutations) => this.handleMutations(mutations), {
      childList: true,
      subtree: true
    })

    // Run an initial scan in case the page already has resolved threads
    this.scanDocument()
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        this.checkForResolution(node as Element)
      }

      // Also check modified attribute targets (Figma often toggles aria attrs)
      if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
        this.checkForResolution(mutation.target as Element)
      }
    }
  }

  private scanDocument(): void {
    log("running initial document scan")

    // Figma Design: resolved comment badge
    const resolvedEls = document.querySelectorAll(
      '[aria-label*="resolved" i], [class*="resolved"], [data-resolved="true"], [data-testid*="resolved"]'
    )
    log(`initial scan found ${resolvedEls.length} potential resolved elements`)
    resolvedEls.forEach((el) => this.checkForResolution(el))

    // FigJam: scan for resolved sticky/comment markers
    if (isFigJam()) {
      const figjamResolved = document.querySelectorAll(
        '[data-resolved], [aria-label*="Resolve" i], [class*="comment"][class*="done"]'
      )
      log(`FigJam scan found ${figjamResolved.length} potential resolved markers`)
      figjamResolved.forEach((el) => this.checkForResolution(el))
    }
  }

  private checkForResolution(root: Element): void {
    // ── Figma Design selectors ──────────────────────────────────────────────

    const designResolved = [
      ...Array.from(root.querySelectorAll('[aria-label*="resolved" i]')),
      ...Array.from(root.querySelectorAll('[class*="resolved"]')),
      ...Array.from(root.querySelectorAll('[data-resolved="true"]')),
      ...Array.from(root.querySelectorAll('[data-testid*="resolved"]'))
    ]

    // ── FigJam selectors ────────────────────────────────────────────────────
    // FigJam renders a "Resolve" button on comments; when clicked it adds
    // resolved state via aria or data attributes.

    const figjamResolved = isFigJam()
      ? [
          ...Array.from(root.querySelectorAll('[aria-label="Resolve"]')),
          ...Array.from(root.querySelectorAll('[aria-label="Resolved"]')),
          ...Array.from(root.querySelectorAll('[aria-pressed="true"][aria-label*="resolve" i]')),
          ...Array.from(root.querySelectorAll('[class*="thread"][class*="resolved"]')),
          ...Array.from(root.querySelectorAll('[class*="comment"][class*="resolved"]'))
        ]
      : []

    // ── Check root element itself ───────────────────────────────────────────

    const selfMatch =
      root.getAttribute("aria-label")?.toLowerCase().includes("resolved") ||
      (typeof root.className === "string" && root.className.toLowerCase().includes("resolved")) ||
      root.getAttribute("data-resolved") === "true" ||
      root.getAttribute("aria-pressed") === "true"

    const candidates = [...designResolved, ...figjamResolved, ...(selfMatch ? [root] : [])]

    for (const marker of candidates) {
      const threadId = this.extractThreadId(marker)
      if (!threadId || seenResolutions.has(threadId)) continue

      log("resolved thread detected — id:", threadId, "element:", marker.tagName, marker.className)
      seenResolutions.add(threadId)
      this.emit(threadId, marker)
    }
  }

  private extractThreadId(el: Element): string | null {
    return (
      el.getAttribute("data-thread-id") ??
      el.getAttribute("data-comment-id") ??
      el.getAttribute("data-id") ??
      el.getAttribute("id") ??
      (window.location.hash ? window.location.hash.replace("#", "") : null)
    )
  }

  private emit(threadId: string, el: Element): void {
    const commentText =
      el.closest("[class*='thread'], [class*='comment']")
        ?.querySelector("[class*='message'], [class*='body'], [class*='text']")
        ?.textContent?.trim() ?? ""

    const pageType = isFigJam() ? "FigJam" : "Figma"

    const event: DetectedEvent = {
      id: generateId(),
      site: "figma",
      eventType: `${pageType.toUpperCase()}_COMMENT_RESOLVED`,
      sourceUrl: window.location.href,
      externalEntityId: threadId,
      title: `${pageType} comment resolved`,
      description: commentText
        ? `Comment resolved: "${commentText.slice(0, 120)}"`
        : `A ${pageType} comment thread was marked as resolved`,
      rawData: { threadId, commentText, pageType },
      occurredAt: now()
    }

    log("emitting event:", event.eventType, event.title)
    this.callback(event)
  }
}
