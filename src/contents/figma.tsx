import cssText from "data-text:~/style.css"
import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import React, { useEffect, useState } from "react"
import { FloatingPrompt } from "~components/FloatingPrompt"
import { FigmaDetector } from "~content/sites/figma"
import { sendToBackground } from "~lib/messaging"
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
  const [event, setEvent] = useState<DetectedEvent | null>(null)

  useEffect(() => {
    console.debug("[CG:figma:content] content script mounted on:", window.location.href)

    const detector = new FigmaDetector("figma", (detected) => {
      console.debug("[CG:figma:content] event detected, showing prompt:", detected.eventType)
      setEvent(detected)
      sendToBackground({ type: "DECISION_DETECTED", payload: detected }).catch(
        (e) => console.error("[CG:figma:content] sendToBackground failed", e)
      )
    })

    detector.start()
    return () => detector.stop()
  }, [])

  if (!event) return null

  return <FloatingPrompt event={event} onDismiss={() => setEvent(null)} />
}

export default FigmaContent
