"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageComparisonProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function ImageComparison({
  beforeImage,
  afterImage,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: ImageComparisonProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (!isResizing || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setPosition(percentage);
    },
    [isResizing]
  );

  const handlePointerUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing, handlePointerMove, handlePointerUp]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-muted/20 select-none group touch-none",
        isFullscreen ? "h-screen rounded-none" : "aspect-video",
        className
      )}
      onPointerDown={(e) => {
        setIsResizing(true);
        handlePointerMove(e);
      }}
    >
      {/* After Image (Base) */}
      <div className="absolute inset-0 w-full h-full">
        <Image
          src={afterImage}
          alt={afterLabel}
          fill
          className="object-cover pointer-events-none"
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
        />
        <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-sm font-medium z-10">
          {afterLabel}
        </div>
      </div>

      {/* Before Image (Clipped) */}
      <div
        className="absolute inset-0 w-full h-full will-change-transform"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Image
          src={beforeImage}
          alt={beforeLabel}
          fill
          className="object-cover pointer-events-none"
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
        />
        <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-sm font-medium z-10">
          {beforeLabel}
        </div>
      </div>

      {/* Slider Handle */}
      <div
        className="absolute inset-y-0 w-1 bg-white cursor-ew-resize flex items-center justify-center z-20 hover:bg-primary transition-colors"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        <div className="w-8 h-8 bg-white text-zinc-900 rounded-full shadow-lg flex items-center justify-center -ml-0.5 border border-zinc-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8L22 12L18 16" />
            <path d="M6 8L2 12L6 16" />
          </svg>
        </div>
      </div>

      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 z-30 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="p-2 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white rounded-full transition-colors"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
    </div>
  );
}
