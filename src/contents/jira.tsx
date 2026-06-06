import cssText from "data-text:~/style.css"
import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import React, { useEffect, useState } from "react"
import { FloatingPrompt } from "~components/FloatingPrompt"
import { JiraDetector } from "~content/sites/jira"
import { sendToBackground } from "~lib/messaging"
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
  const [event, setEvent] = useState<DetectedEvent | null>(null)

  useEffect(() => {
    const detector = new JiraDetector("jira", (detected) => {
      setEvent(detected)
      // Notify background so it can store the event
      sendToBackground({ type: "DECISION_DETECTED", payload: detected }).catch(
        console.error
      )
    })

    detector.start()
    return () => detector.stop()
  }, [])

  if (!event) return null

  return (
    <FloatingPrompt
      event={event}
      onDismiss={() => setEvent(null)}
    />
  )
}

export default JiraContent
