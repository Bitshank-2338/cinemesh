'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PipWindowProps {
  open:    boolean
  onClose: () => void
  width?:  number
  height?: number
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
  width  = 380,
  height = 640,
  children,
}: PipWindowProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)

  useEffect(() => {
    if (!open) return
    if (!isDocumentPipSupported()) {
      onClose()
      return
    }

    let cancelled    = false
    let opened: Window | null = null

    const closeHandler = () => {
      setPipWindow(null)
      onClose()
    }

    ;(async () => {
      try {
        const w = await window.documentPictureInPicture!.requestWindow({ width, height })
        if (cancelled) { w.close(); return }
        opened = w

        // Copy parent document's stylesheets/inline styles so Tailwind etc. work
        document
          .querySelectorAll('link[rel="stylesheet"], style')
          .forEach(node => {
            try { w.document.head.appendChild(node.cloneNode(true)) } catch {}
          })

        // Window baseline styles to match the app's dark theme
        w.document.documentElement.style.colorScheme = 'dark'
        w.document.body.style.cssText =
          'margin:0;padding:0;background:#06060e;color:#f0f0f4;' +
          'font-family:Inter,system-ui,-apple-system,sans-serif;' +
          'overflow:hidden;'
        w.document.title = 'CineMesh — Chat & Cams'

        w.addEventListener('pagehide', closeHandler, { once: true })

        setPipWindow(w)
      } catch (err) {
        console.warn('[PiP] requestWindow rejected', err)
        if (!cancelled) onClose()
      }
    })()

    return () => {
      cancelled = true
      if (opened) {
        opened.removeEventListener('pagehide', closeHandler)
        try { opened.close() } catch {}
      }
      setPipWindow(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!pipWindow) return null
  return createPortal(children, pipWindow.document.body)
}
