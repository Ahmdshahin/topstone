"use client";

import React, { createContext, useContext } from "react";

type Dictionary = Record<string, any>; // In a real app, type this strictly against en.json

interface TranslationContextType {
  lang: string;
  dict: Dictionary;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export function TranslationProvider({ 
  children, 
  lang, 
  dict 
}: { 
  children: React.ReactNode; 
  lang: string; 
  dict: Dictionary; 
}) {
  return (
    <TranslationContext.Provider value={{ lang, dict }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslation must be used within a TranslationProvider");
  }
  return context;
}
