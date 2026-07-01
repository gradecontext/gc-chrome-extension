import React from "react"
import logoWhite from "../../assets/logos/context-grade-logo-white.svg"
import { WEBAPP_URL } from "~lib/constants"
import { Button } from "./ui/Button"

interface SignInPromptProps {
  compact?: boolean // true → used inside the side panel (less padding)
}

export function SignInPrompt({ compact = false }: SignInPromptProps) {
  function openSignIn() {
    chrome.tabs.create({ url: `${WEBAPP_URL}/login` })
  }

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-accent-50 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-accent-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Sign in to ContextGrade</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Your session has expired or you haven't signed in yet.
          </p>
        </div>
        <Button size="sm" onClick={openSignIn}>
          Sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Logo mark */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-accent-600 flex items-center justify-center">
          <img src={logoWhite} alt="" className="w-4 h-4" />
        </div>
        <span className="text-sm font-bold text-gray-900">ContextGrade</span>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-sm text-gray-700 font-medium leading-snug">
          Sign in to start capturing decision context
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          ContextGrade detects meaningful actions in Jira, Figma, and HubSpot and
          prompts you to save the reasoning behind them.
        </p>
        <Button onClick={openSignIn} className="w-full">
          Sign in to ContextGrade
        </Button>
        <p className="text-xs text-gray-400 text-center">
          After signing in, come back here — the extension will connect automatically.
        </p>
      </div>
    </div>
  )
}
