import React, { useEffect, useState } from "react"

interface FloatingIconProps {
  hasNotification: boolean
  isAuthenticated: boolean | null // null = still loading
  onClick: () => void
}

export function FloatingIcon({ hasNotification, isAuthenticated, onClick }: FloatingIconProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`fixed bottom-6 right-6 z-[2147483647] transition-all duration-300 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      <button
        onClick={onClick}
        title={
          isAuthenticated === false
            ? "ContextGrade — click to sign in"
            : hasNotification
            ? "Decision detected — click to save reasoning"
            : "ContextGrade — track decisions"
        }
        className="relative w-12 h-12 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center select-none">
          <span className="text-white text-xs font-bold leading-none">CG</span>
        </div>

        {/* Pulsing indigo dot when an event is waiting */}
        {hasNotification && (
          <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white animate-pulse" />
        )}

        {/* Amber warning dot when not signed in */}
        {!hasNotification && isAuthenticated === false && (
          <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" />
        )}
      </button>
    </div>
  )
}
