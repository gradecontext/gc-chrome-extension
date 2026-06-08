import cssText from "data-text:~/style.css"
import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import React, { useEffect, useState } from "react"
import { FloatingIcon } from "~components/FloatingIcon"
import { FloatingPrompt } from "~components/FloatingPrompt"
import { JiraDetector } from "~content/sites/jira"
import { useAuth } from "~hooks/useAuth"
import { sendToBackground } from "~lib/messaging"
import { getSettings } from "~lib/storage"
import type { DetectedEvent } from "~types"

export const config: PlasmoCSConfig = {
  matches: ["https://*.atlassian.net/*", "https://*.jira.com/*"],
  all_frames: false
}

export const getShadowHostId: PlasmoGetShadowHostId = () => "cg-jira-host"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const JiraContent = () => {
  const [pendingEvent, setPendingEvent] = useState<DetectedEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const { isAuthenticated, loading: authLoading } = useAuth()

  useEffect(() => {
    getSettings().then((s) => setEnabled(s.enabled && s.enabledSites.jira))
  }, [])

  useEffect(() => {
    if (!enabled) return
    console.log("[CG:jira] content script mounted on:", window.location.href)

    const detector = new JiraDetector("jira", (detected) => {
      console.log("[CG:jira] event detected:", detected.eventType)
      setPendingEvent(detected)
      setShowPrompt(true)
      sendToBackground({ type: "DECISION_DETECTED", payload: detected }).catch(
        (e) => console.error("[CG:jira] sendToBackground failed", e)
      )
    })

    detector.start()
    return () => detector.stop()
  }, [enabled])

  if (!enabled) return null

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

export default JiraContent
