import React from "react"

type Color = "accent" | "green" | "amber" | "red" | "gray"

interface BadgeProps {
  children: React.ReactNode
  color?: Color
}

const colors: Record<Color, string> = {
  accent: "bg-accent-100 text-accent-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-600"
}

export function Badge({ children, color = "gray" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>
      {children}
    </span>
  )
}
