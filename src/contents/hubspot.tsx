import cssText from "data-text:~/style.css"
import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import React, { useEffect, useState } from "react"
import { FloatingPrompt } from "~components/FloatingPrompt"
import { HubSpotDetector } from "~content/sites/hubspot"
import { sendToBackground } from "~lib/messaging"
import type { DetectedEvent } from "~types"

export const config: PlasmoCSConfig = {
  matches: ["https://*.hubspot.com/*", "https://app.hubspot.com/*"],
  all_frames: false
}

export const getShadowHostId: PlasmoGetShadowHostId = () => "cg-hubspot-host"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const HubSpotContent = () => {
  const [event, setEvent] = useState<DetectedEvent | null>(null)

  useEffect(() => {
    const detector = new HubSpotDetector("hubspot", (detected) => {
      setEvent(detected)
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

export default HubSpotContent
