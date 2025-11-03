"use client"

import { useState } from "react"

export default function Home() {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  return (
    <div className="min-h-screen w-full overflow-hidden flex items-center justify-center relative">
      <div
        className="fixed inset-0 bg-contain bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/harvest-heist-bg.gif')",
          width: "100vw",
          height: "100vh",
        }}
      />

      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-12 px-4">
        {/* Title */}
        <div className="text-center mb-8">
          <h1
            className="text-6xl md:text-8xl font-bold text-white mb-2"
            style={{
              fontFamily: '"Press Start 2P", cursive',
              textShadow: "6px 6px 0px rgba(0, 0, 0, 0.9), 12px 12px 0px rgba(255, 215, 0, 0.4)",
              letterSpacing: "4px",
            }}
          >
            HARVEST HEIST
          </h1>
          <p
            className="text-white mt-4"
            style={{
              fontFamily: '"Press Start 2P", cursive',
              textShadow: "3px 3px 0px rgba(0, 0, 0, 0.8)",
              fontSize: "12px",
              letterSpacing: "2px",
            }}
          >
            STEAL THE CROPS
          </p>
        </div>

        {/* Buttons Container */}
        <div className="flex flex-col gap-6 w-full max-w-sm">
          {/* Play Game Button */}
          <PixelButton
            label="PLAY GAME"
            color="from-amber-400 to-amber-600"
            isHovered={hoveredButton === "play"}
            onHover={() => setHoveredButton("play")}
            onLeave={() => setHoveredButton(null)}
          />

          {/* Join Button */}
          <PixelButton
            label="JOIN"
            color="from-green-400 to-green-600"
            isHovered={hoveredButton === "join"}
            onHover={() => setHoveredButton("join")}
            onLeave={() => setHoveredButton(null)}
          />

          {/* Leaderboard Button */}
          <PixelButton
            label="LEADERBOARD"
            color="from-purple-400 to-purple-600"
            isHovered={hoveredButton === "leaderboard"}
            onHover={() => setHoveredButton("leaderboard")}
            onLeave={() => setHoveredButton(null)}
          />
        </div>
      </div>
    </div>
  )
}

interface PixelButtonProps {
  label: string
  color: string
  isHovered: boolean
  onHover: () => void
  onLeave: () => void
}

function PixelButton({ label, color, isHovered, onHover, onLeave }: PixelButtonProps) {
  return (
    <button
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={() => {
        console.log(`${label} button clicked`)
      }}
      className={`
        px-8 py-4 w-full font-bold text-white
        border-4 border-gray-900 rounded-lg
        transition-all duration-150 transform
        ${isHovered ? "scale-105 shadow-2xl" : "shadow-lg"}
        ${isHovered ? "translate-y-[-4px]" : "translate-y-0"}
        bg-gradient-to-b ${color}
        hover:brightness-110
        active:scale-95
        cursor-pointer
      `}
      style={{
        fontFamily: '"Press Start 2P", cursive',
        fontSize: "14px",
        letterSpacing: "1px",
        textShadow: "2px 2px 0px rgba(0, 0, 0, 0.7)",
        boxShadow: isHovered
          ? "0 8px 16px rgba(0, 0, 0, 0.5), inset 0 -4px 0 rgba(0, 0, 0, 0.4)"
          : "0 4px 8px rgba(0, 0, 0, 0.4), inset 0 -4px 0 rgba(0, 0, 0, 0.4)",
      }}
    >
      {label}
    </button>
  )
}
