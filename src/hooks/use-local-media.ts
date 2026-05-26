'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MediaManager, type MediaPermissionError } from '@/lib/media-manager'

export type MediaStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'error'
  | 'screen-sharing'

export interface LocalMediaState {
  localStream:    MediaStream | null   // camera + mic stream
  screenStream:   MediaStream | null   // screen share stream
  status:         MediaStatus
  error:          MediaPermissionError | null
  isMicOn:        boolean
  isCameraOn:     boolean
  isScreenSharing: boolean

  requestMedia:   () => Promise<void>
  toggleMic:      () => void
  toggleCamera:   () => void
  startScreen:    () => Promise<void>
  stopScreen:     () => void
  stopAll:        () => void
}

export function useLocalMedia(): LocalMediaState {
  const [localStream,    setLocalStream]    = useState<MediaStream | null>(null)
  const [screenStream,   setScreenStream]   = useState<MediaStream | null>(null)
  const [status,         setStatus]         = useState<MediaStatus>('idle')
  const [error,          setError]          = useState<MediaPermissionError | null>(null)
  const [isMicOn,        setIsMicOn]        = useState(true)
  const [isCameraOn,     setIsCameraOn]     = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const localStreamRef  = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Keep refs in sync with state
  useEffect(() => { localStreamRef.current  = localStream  }, [localStream])
  useEffect(() => { screenStreamRef.current = screenStream }, [screenStream])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      localStreamRef.current  && MediaManager.stopStream(localStreamRef.current)
      screenStreamRef.current && MediaManager.stopStream(screenStreamRef.current)
    }
  }, [])

  // ── Request camera + mic ──────────────────────────────────────────────────
  const requestMedia = useCallback(async () => {
    setStatus('requesting')
    setError(null)

    const { stream, error } = await MediaManager.getCameraAndMic()

    if (error || !stream) {
      setError(error ?? 'unknown')
      setStatus('error')
      return
    }

    setLocalStream(stream)
    setStatus('active')
    setIsMicOn(true)
    setIsCameraOn(true)
  }, [])

  // ── Toggle mic (mute/unmute track, does NOT stop it) ─────────────────────
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !isMicOn
    MediaManager.setMicEnabled(stream, next)
    setIsMicOn(next)
  }, [isMicOn])

  // ── Toggle camera (enable/disable track, does NOT stop it) ───────────────
  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !isCameraOn
    MediaManager.setCameraEnabled(stream, next)
    setIsCameraOn(next)
  }, [isCameraOn])

  // ── Screen share ──────────────────────────────────────────────────────────
  const startScreen = useCallback(async () => {
    const { stream, error } = await MediaManager.getScreen()
    if (error || !stream) {
      setError(error ?? 'unknown')
      return
    }

    // When user stops share from browser UI
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      setScreenStream(null)
      setIsScreenSharing(false)
    })

    setScreenStream(stream)
    setIsScreenSharing(true)
  }, [])

  const stopScreen = useCallback(() => {
    const stream = screenStreamRef.current
    if (stream) MediaManager.stopStream(stream)
    setScreenStream(null)
    setIsScreenSharing(false)
  }, [])

  // ── Stop all media ────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (localStreamRef.current)  MediaManager.stopStream(localStreamRef.current)
    if (screenStreamRef.current) MediaManager.stopStream(screenStreamRef.current)
    setLocalStream(null)
    setScreenStream(null)
    setStatus('idle')
    setIsScreenSharing(false)
  }, [])

  return {
    localStream,
    screenStream,
    status,
    error,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    requestMedia,
    toggleMic,
    toggleCamera,
    startScreen,
    stopScreen,
    stopAll,
  }
}
