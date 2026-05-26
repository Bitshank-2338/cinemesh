'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PipWindowProps {
  open:    boolean
  onClose: () => void
  width?:  number
  height?: number
  /** If true, fall back to window.open() when Document PiP isn't supported. */
  allowPopupFallback?: boolean
  children: ReactNode
}

// ─── Document Picture-in-Picture type augmentation ────────────────────────
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
  window: Window | null
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

export const isDocumentPipSupported = (): boolean =>
  typeof window !== 'undefined' && 'documentPictureInPicture' in window

/**
 * Document Picture-in-Picture portal.
 *
 * When `open` flips true, opens a separate OS-level always-on-top window
 * (Chromium 116+). React children are rendered into that window via a
 * portal. Because it's a real native window — not a browser tab — it
 * floats above all other applications and does NOT appear in
 * getDisplayMedia screen captures.
 */
export function PipWindow({
  open,
  onClose,
  width  = 400,
  height = 680,
  allowPopupFallback = true,
  children,
}: PipWindowProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)

  useEffect(() => {
    if (!open) return
    if (typeof window === 'undefined') return

    let cancelled    = false
    let opened: Window | null = null

    const closeHandler = () => {
      setPipWindow(null)
      onClose()
    }

    const setupWindow = (w: Window) => {
      // Copy parent document's stylesheets so Tailwind/fonts/theme variables work
      document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach(node => {
          try { w.document.head.appendChild(node.cloneNode(true)) } catch {}
        })
      w.document.documentElement.style.colorScheme = 'dark'
      w.document.body.style.cssText =
        'margin:0;padding:0;background:#06060e;color:#f0f0f4;' +
        'font-family:Inter,system-ui,-apple-system,sans-serif;' +
        'overflow:hidden;'
      w.document.title = 'CineMesh — Chat & Cams'
      w.addEventListener('pagehide', closeHandler, { once: true })
      w.addEventListener('beforeunload', closeHandler, { once: true })
    }

    ;(async () => {
      // ── Prefer Document Picture-in-Picture (always-on-top, Chromium 116+) ──
      if (isDocumentPipSupported()) {
        try {
          const w = await window.documentPictureInPicture!.requestWindow({ width, height })
          if (cancelled) { w.close(); return }
          opened = w
          setupWindow(w)
          setPipWindow(w)
          return
        } catch (err) {
          console.warn('[PiP] Document PiP failed, falling back to popup', err)
          // fall through to window.open below
        }
      }

      // ── Fallback: regular browser popup (NOT always-on-top, but still usable) ──
      if (allowPopupFallback) {
        const features = `popup=yes,width=${width},height=${height},left=${screen.availWidth - width - 20},top=80,menubar=no,toolbar=no,location=no,status=no`
        const w = window.open('about:blank', 'cinemesh_pip', features)
        if (!w) {
          console.warn('[PiP] popup was blocked')
          if (!cancelled) onClose()
          return
        }
        if (cancelled) { w.close(); return }
        opened = w
        setupWindow(w)
        setPipWindow(w)
      } else {
        if (!cancelled) onClose()
      }
    })()

    return () => {
      cancelled = true
      if (opened) {
        try { opened.removeEventListener('pagehide', closeHandler) } catch {}
        try { opened.close() } catch {}
      }
      setPipWindow(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!pipWindow) return null
  return createPortal(children, pipWindow.document.body)
}
