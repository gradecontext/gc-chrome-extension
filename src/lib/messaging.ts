import type { ExtensionMessage } from "~types"

// Send a typed message to the background service worker
export function sendToBackground(message: ExtensionMessage): Promise<unknown> {
  return chrome.runtime.sendMessage(message)
}

// Send a typed message to a specific tab's content script
export function sendToTab(
  tabId: number,
  message: ExtensionMessage
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message)
}

// Typed wrapper around chrome.runtime.onMessage for background listeners
export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
): void {
  chrome.runtime.onMessage.addListener(handler)
}
