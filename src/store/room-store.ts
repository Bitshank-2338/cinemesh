/**
 * room-store.ts — UI-only state.
 *
 * Does NOT hold participants, messages, or playback data.
 * Those come from useRoomChannel (network) and useLocalMedia (device).
 * This store only tracks panel visibility and local device toggle intent.
 */
import { create } from 'zustand'

interface RoomUIState {
  // Panel visibility
  isChatOpen:      boolean
  isSettingsOpen:  boolean
  isInviteOpen:    boolean

  // Room identity (set once when entering)
  roomId:   string | null
  roomName: string | null
  roomCode: string | null

  // Actions
  setRoom:         (id: string, name: string, code: string) => void
  toggleChat:      () => void
  toggleSettings:  () => void
  toggleInvite:    () => void
  openInvite:      () => void
  clearRoom:       () => void
}

export const useRoomStore = create<RoomUIState>((set) => ({
  isChatOpen:     true,
  isSettingsOpen: false,
  isInviteOpen:   false,

  roomId:   null,
  roomName: null,
  roomCode: null,

  setRoom:        (id, name, code) => set({ roomId: id, roomName: name, roomCode: code }),
  toggleChat:     () => set(s => ({ isChatOpen:     !s.isChatOpen })),
  toggleSettings: () => set(s => ({ isSettingsOpen: !s.isSettingsOpen })),
  toggleInvite:   () => set(s => ({ isInviteOpen:   !s.isInviteOpen })),
  openInvite:     () => set({ isInviteOpen: true }),
  clearRoom:      () => set({ roomId: null, roomName: null, roomCode: null }),
}))
