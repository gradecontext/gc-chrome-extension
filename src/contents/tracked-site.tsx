import cssText from "data-text:~/style.css"
import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import React from "react"
import { FloatingIcon } from "~components/FloatingIcon"
import { useAuth } from "~hooks/useAuth"
import { useTrackedSource } from "~hooks/useTrackedSource"
import { sendToBackground } from "~lib/messaging"

// Catch-all for any admin-registered domain that doesn't have a dedicated
// integration (e.g. lattice.com, bamboohr.com). Manual capture only — no
// site-specific DOM event detection. Figma/Jira/HubSpot/the webapp itself
// are excluded below since they're handled by their own content scripts.
export const config: PlasmoCSConfig = {
  matches: ["https://*/*"],
  exclude_matches: [
    "https://www.figma.com/*",
    "https://*.hubspot.com/*",
    "https://app.hubspot.com/*",
    "https://*.atlassian.net/*",
    "https://*.jira.com/*",
    "https://app.contextgrade.com/*"
  ],
  all_frames: false
}

export const getShadowHostId: PlasmoGetShadowHostId = () => "cg-tracked-site-host"

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const TrackedSiteContent = () => {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { source, loading: sourceLoading } = useTrackedSource(window.location.href)

  // Unlike the dedicated site scripts, we don't show the icon pre-auth here —
  // this script runs on every https site, and surfacing ContextGrade on
  // arbitrary unregistered domains (banks, personal email, etc.) before we
  // even know the domain is tracked would violate "minimal and unobtrusive."
  if (authLoading || sourceLoading || !isAuthenticated || !source) return null

  async function handleIconClick() {
    await sendToBackground({ type: "OPEN_PANEL" }).catch(console.error)
  }

  return (
    <FloatingIcon hasNotification={false} isAuthenticated={true} onClick={handleIconClick} />
  )
}

export default TrackedSiteContent
