import type { DetectedEvent, SourceApp } from "~types"
import { isChromeContextValid } from "~lib/utils"

export type DetectionCallback = (event: DetectedEvent) => void

// Base class for site-specific detectors.
// Each subclass provides `attach()` which wires up MutationObserver(s).
export abstract class BaseDetector {
  protected readonly site: SourceApp
  protected readonly callback: DetectionCallback
  protected observers: MutationObserver[] = []
  private started = false

  constructor(site: SourceApp, callback: DetectionCallback) {
    this.site = site
    this.callback = callback
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.attach()
  }

  stop(): void {
    this.observers.forEach((o) => o.disconnect())
    this.observers = []
    this.started = false
  }

  protected abstract attach(): void

  // Helper: observe a target element and call handler on each mutation
  protected observe(
    target: Element | Document,
    handler: MutationCallback,
    options: MutationObserverInit = { childList: true, subtree: true }
  ): void {
    const obs = new MutationObserver((mutations, observer) => {
      if (!isChromeContextValid()) {
        this.stop()
        return
      }
      handler(mutations, observer)
    })
    obs.observe(target, options)
    this.observers.push(obs)
  }
}
