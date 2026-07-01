import React from "react"
import { Button } from "~components/ui/Button"
import { WEBAPP_URL } from "~lib/constants"

interface Props {
  onAcknowledge: () => void
}

export function FirstRunDisclosure({ onAcknowledge }: Props) {
  return (
    <div className="flex flex-col h-full font-sans bg-white">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-snug">
            Before you get started
          </h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            ContextGrade captures the reasoning behind workplace decisions. Here is
            exactly what it collects — and what it doesn't.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">What you write</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                The decision summary and rationale you type into the form, plus the
                category and type you select.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">The page URL</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                The URL of the page where you log a decision, and status labels already
                displayed on registered sites (e.g. "Done", "Closed Won").
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">Your session token</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                The authentication token issued when you sign in — never your password.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Never collected</p>
          <p className="text-xs text-red-600 leading-relaxed">
            Passwords, payment details, private messages, keystrokes, form fields you're
            actively typing into, mouse movement, scrolling, or general browsing activity.
          </p>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          The extension only runs on domains your organization's admin has explicitly
          registered — it does nothing on the open web.{" "}
          <a
            href={`${WEBAPP_URL}/privacy`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-600 hover:underline">
            Read the full Privacy Policy
          </a>
        </p>
      </div>

      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <Button className="w-full" onClick={onAcknowledge}>
          I understand — Get started
        </Button>
      </div>
    </div>
  )
}
