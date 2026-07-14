"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface PhotoSliderProps {
  images: string[];
  title?: string;
  description?: string;
}

export function PhotoSlider({ images, title, description }: PhotoSliderProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  if (!images || images.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      // Scroll by roughly half the screen width
      const scrollAmount = window.innerWidth * 0.4;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setSelectedIndex(null);
    document.body.style.overflow = "auto";
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  };

  return (
    <div className="w-full">
      {(title || description) && (
        <div className="mb-8 text-center">
          {title && <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-4">{title}</h2>}
          {description && <p className="text-lg text-muted-foreground">{description}</p>}
        </div>
      )}

      {/* Slider Container */}
      <div className="relative w-full group/slider">
        {/* Navigation Arrows for Slider */}
        {images.length > 1 && (
          <>
            <button 
              onClick={() => scroll('left')}
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 -mt-4 z-10 p-3 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-xl text-foreground opacity-100 md:opacity-0 md:group-hover/slider:opacity-100 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
            </button>
            <button 
              onClick={() => scroll('right')}
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 -mt-4 z-10 p-3 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-xl text-foreground opacity-100 md:opacity-0 md:group-hover/slider:opacity-100 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
            </button>
          </>
        )}

        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-4 pb-8 snap-x snap-mandatory scrollbar-hide px-4 md:px-0" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {images.map((src, idx) => (
            <div 
              key={idx} 
              className="relative flex-shrink-0 w-[85vw] sm:w-[60vw] md:w-[40vw] lg:w-[30vw] aspect-video snap-center rounded-2xl overflow-hidden cursor-pointer group shadow-lg ring-1 ring-border bg-secondary/20"
              onClick={() => openLightbox(idx)}
            >
              <Image 
                src={src} 
                alt={`${title || 'Gallery'} image ${idx + 1}`} 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 85vw, (max-width: 1200px) 40vw, 30vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Overlay */}
      <AnimatePresence>
        {selectedIndex !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={closeLightbox}
          >
            {/* Close Button */}
            <button 
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-[110]"
              onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation Buttons (only if multiple images) */}
            {images.length > 1 && (
              <>
                <button 
                  className="absolute left-4 md:left-8 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-[110]"
                  onClick={prevImage}
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button 
                  className="absolute right-4 md:right-8 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white z-[110]"
                  onClick={nextImage}
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            {/* Current Image */}
            <motion.div 
              key={selectedIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-[90vw] h-[80vh] flex items-center justify-center pointer-events-none"
            >
              <Image 
                src={images[selectedIndex] || ""} 
                alt={`${title || 'Gallery'} image ${selectedIndex + 1}`} 
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </motion.div>
            
            {/* Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 font-medium tracking-wide">
                {selectedIndex + 1} / {images.length}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
