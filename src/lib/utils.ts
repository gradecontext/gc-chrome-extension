// Returns false when the extension has been reloaded but this content script
// is still alive as a zombie — any chrome.* call would throw in that state.
export function isChromeContextValid(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).chrome.runtime.getURL("")
    return true
  } catch {
    return false
  }
}

export function generateId(): string {
  return `cg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function now(): string {
  return new Date().toISOString()
}

// Truncate long strings for display
export function truncate(text: string, maxLength = 60): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

// Safely read a DOM attribute — returns null rather than throwing
export function attr(el: Element | null, name: string): string | null {
  return el?.getAttribute(name) ?? null
}

// Extract innerText without crashing if el is null
export function text(el: Element | null): string {
  return el?.textContent?.trim() ?? ""
}

// Derive a human-readable event label from a raw event type string
export function labelFromEventType(eventType: string): string {
  return eventType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Detect the SourceApp from a tab URL. Known tools map to their literal
// SourceApp; anything else (e.g. a generically-tracked domain like
// lattice.com) falls back to the hostname itself so source_app stays accurate.
export function detectSiteFromUrl(url: string): string {
  if (/figma\.com/.test(url)) return "figma"
  if (/atlassian\.net|jira\./.test(url)) return "jira"
  if (/hubspot\.com/.test(url)) return "hubspot"
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "unknown"
  }
}

// Wait for an element matching selector to appear in the DOM
export function waitForElement(
  selector: string,
  timeout = 5000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector)
    if (el) return resolve(el)

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) {
        observer.disconnect()
        resolve(found)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}
