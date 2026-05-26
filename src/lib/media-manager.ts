/**
 * MediaManager — wraps getUserMedia and getDisplayMedia with clean error handling.
 *
 * Does NOT hold React state. Use the use-local-media hook for React integration.
 */

export type MediaPermissionError =
  | 'not-allowed'       // User denied permission
  | 'not-found'         // Device not found
  | 'overconstrained'   // Constraints not satisfiable
  | 'in-use'            // Device in use by another app
  | 'not-supported'     // Browser doesn't support the API
  | 'unknown'

export interface MediaResult<T> {
  stream: T | null
  error: MediaPermissionError | null
}

// ─── Constraints ──────────────────────────────────────────────────────────────
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width:     { ideal: 1280 },
    height:    { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: 'user',
  },
  audio: false,
}

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation:    true,
    noiseSuppression:    true,
    autoGainControl:     true,
    sampleRate:          { ideal: 48000 },
  },
  video: false,
}

const CAMERA_AND_MIC_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width:     { ideal: 1280 },
    height:    { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: 'user',
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl:  true,
  },
}

// ─── Error mapping ────────────────────────────────────────────────────────────
function classifyError(err: unknown): MediaPermissionError {
  if (!(err instanceof Error)) return 'unknown'
  const name = (err as Error).name
  if (name === 'NotAllowedError'  || name === 'PermissionDeniedError') return 'not-allowed'
  if (name === 'NotFoundError'    || name === 'DevicesNotFoundError')   return 'not-found'
  if (name === 'NotReadableError' || name === 'TrackStartError')        return 'in-use'
  if (name === 'OverconstrainedError')                                   return 'overconstrained'
  if (name === 'TypeError')                                              return 'not-supported'
  return 'unknown'
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const MediaManager = {
  isSupported(): boolean {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    )
  },

  async getCameraAndMic(): Promise<MediaResult<MediaStream>> {
    if (!this.isSupported()) return { stream: null, error: 'not-supported' }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_AND_MIC_CONSTRAINTS)
      return { stream, error: null }
    } catch (err) {
      return { stream: null, error: classifyError(err) }
    }
  },

  async getCamera(): Promise<MediaResult<MediaStream>> {
    if (!this.isSupported()) return { stream: null, error: 'not-supported' }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      return { stream, error: null }
    } catch (err) {
      return { stream: null, error: classifyError(err) }
    }
  },

  async getMic(): Promise<MediaResult<MediaStream>> {
    if (!this.isSupported()) return { stream: null, error: 'not-supported' }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
      return { stream, error: null }
    } catch (err) {
      return { stream: null, error: classifyError(err) }
    }
  },

  async getScreen(): Promise<MediaResult<MediaStream>> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !('getDisplayMedia' in navigator.mediaDevices)
    ) {
      return { stream: null, error: 'not-supported' }
    }
    try {
      // Higher framerate for movie playback; request tab/system audio.
      // Chrome's share dialog will show a "Share tab audio" checkbox when
      // the user picks a tab — that's how the movie sound gets transmitted.
      const stream = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia(c?: DisplayMediaStreamOptions): Promise<MediaStream>
      }).getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          width:     { ideal: 1920 },
          height:    { ideal: 1080 },
        },
        audio: {
          echoCancellation: false,    // movie audio should not be filtered
          noiseSuppression: false,
          autoGainControl:  false,
          sampleRate:       { ideal: 48000 },
        } as MediaTrackConstraints,
      })
      return { stream, error: null }
    } catch (err) {
      return { stream: null, error: classifyError(err) }
    }
  },

  /** Mute/unmute audio tracks without stopping them */
  setMicEnabled(stream: MediaStream, enabled: boolean): void {
    stream.getAudioTracks().forEach(t => { t.enabled = enabled })
  },

  /** Enable/disable video tracks without stopping them */
  setCameraEnabled(stream: MediaStream, enabled: boolean): void {
    stream.getVideoTracks().forEach(t => { t.enabled = enabled })
  },

  /** Fully stop all tracks and release the device */
  stopStream(stream: MediaStream): void {
    stream.getTracks().forEach(t => t.stop())
  },

  /** Replace video track in a stream (used when switching camera) */
  replaceVideoTrack(
    stream: MediaStream,
    newTrack: MediaStreamTrack
  ): void {
    const oldTracks = stream.getVideoTracks()
    oldTracks.forEach(t => {
      stream.removeTrack(t)
      t.stop()
    })
    stream.addTrack(newTrack)
  },

  /** Enumerate available devices */
  async getDevices(): Promise<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }> {
    if (!this.isSupported()) return { cameras: [], mics: [] }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return {
        cameras: devices.filter(d => d.kind === 'videoinput'),
        mics:    devices.filter(d => d.kind === 'audioinput'),
      }
    } catch {
      return { cameras: [], mics: [] }
    }
  },
}
