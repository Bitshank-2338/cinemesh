'use client'

import { useEffect, useState, useCallback } from 'react'
import { translate, isUntranslatable } from '@/lib/translation'

const LS_KEY = 'cinemesh:targetLang'

/**
 * Provides the user's preferred target language (persisted in localStorage)
 * and a helper to translate text on demand.
 */
export function useTargetLanguage() {
  // Use `''` to mean "translation disabled". Anything else is a language code.
  const [target, setTarget] = useState<string>('')

  // Restore on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(LS_KEY)
    if (saved) setTarget(saved)
  }, [])

  const set = useCallback((code: string) => {
    setTarget(code)
    if (typeof window !== 'undefined') {
      if (code) window.localStorage.setItem(LS_KEY, code)
      else      window.localStorage.removeItem(LS_KEY)
    }
  }, [])

  return { target, setTarget: set }
}

/**
 * Translate a single piece of text to the target language. Re-runs when
 * `text` or `target` change. Returns null while loading or if no target is set.
 */
export function useTranslatedText(text: string, target: string): string | null {
  const [translated, setTranslated] = useState<string | null>(null)

  useEffect(() => {
    if (!target)              { setTranslated(null); return }
    if (isUntranslatable(text)) { setTranslated(null); return }

    let cancelled = false
    translate(text, target).then(r => {
      if (cancelled) return
      // Show nothing if Google echoed back the same text (already in target lang)
      setTranslated(r.text === text ? null : r.text)
    })
    return () => { cancelled = true }
  }, [text, target])

  return translated
}
