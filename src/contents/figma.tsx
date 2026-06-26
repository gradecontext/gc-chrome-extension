import cssText from "data-text:~/style.css"
import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import React, { useEffect, useState } from "react"
import { FloatingIcon } from "~components/FloatingIcon"
import { FloatingPrompt } from "~components/FloatingPrompt"
import { FigmaDetector } from "~content/sites/figma"
import { useAuth } from "~hooks/useAuth"
import { useTrackedSource } from "~hooks/useTrackedSource"
import { sendToBackground } from "~lib/messaging"
import { getSettings } from "~lib/storage"
import type { DetectedEvent } from "~types"

export const config: PlasmoCSConfig = {
  matches: ["https://www.figma.com/*"],
  all_frames: false
}

export const getShadowHostId: PlasmoGetShadowHostId = () => "cg-figma-host"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const FigmaContent = () => {
  const [pendingEvent, setPendingEvent] = useState<DetectedEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [masterEnabled, setMasterEnabled] = useState(true)
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { source, loading: sourceLoading } = useTrackedSource(window.location.href)

  useEffect(() => {
    getSettings().then((s) => setMasterEnabled(s.enabled))
  }, [])

  // Show the icon if the master switch is on, and either the user isn't
  // signed in yet (so they can discover + sign in) or this domain is a
  // registered tracked source.
  const showIcon = masterEnabled && (!isAuthenticated || !!source)
  // Only run DOM detection once we know this domain is actually tracked.
  const canDetect = masterEnabled && !!source

  useEffect(() => {
    if (!canDetect || !source) return
    console.log("[CG:figma] content script mounted on:", window.location.href, "— tracked as", source.external_id)

    const detector = new FigmaDetector("figma", (detected) => {
      console.log("[CG:figma] event detected:", detected.eventType)
      const enriched: DetectedEvent = {
        ...detected,
        sourceCompanyExternalId: source.external_id,
        sourceCompanyName: source.name
      }
      setPendingEvent(enriched)
      setShowPrompt(true)
      sendToBackground({ type: "DECISION_DETECTED", payload: enriched }).catch(
        (e) => console.error("[CG:figma] sendToBackground failed", e)
      )
    })

    detector.start()
    return () => detector.stop()
  }, [canDetect, source])

  if (authLoading || sourceLoading || !showIcon) return null

  async function handleIconClick() {
    if (pendingEvent) {
      await sendToBackground({ type: "OPEN_SIDE_PANEL", payload: pendingEvent }).catch(console.error)
      setPendingEvent(null)
      setShowPrompt(false)
    } else {
      await sendToBackground({ type: "OPEN_PANEL" }).catch(console.error)
    }
  }

  return (
    <>
      <FloatingIcon
        hasNotification={!!pendingEvent}
        isAuthenticated={authLoading ? null : isAuthenticated}
        onClick={handleIconClick}
      />
      {showPrompt && pendingEvent && (
        <FloatingPrompt
          event={pendingEvent}
          onDismiss={() => setShowPrompt(false)}
          onSaved={() => setPendingEvent(null)}
        />
      )}
    </>
  )
}

export default FigmaContent
