'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Mic, Video, Volume2, Bell, Monitor, Shield } from 'lucide-react'
import { modalOverlay, modalContent } from '@/lib/motion'

interface SettingsModalProps {
  onClose: () => void
}

type Tab = 'audio' | 'video' | 'appearance' | 'notifications'

const tabs: { id: Tab; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'audio', icon: Mic, label: 'Audio' },
  { id: 'video', icon: Video, label: 'Video' },
  { id: 'appearance', icon: Monitor, label: 'Display' },
  { id: 'notifications', icon: Bell, label: 'Alerts' },
]

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-[#e0e0ec]">{label}</p>
        {description && <p className="text-xs text-[#5a5a72] mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#c9a84c] outline-none"
        style={{
          background: checked
            ? 'linear-gradient(135deg, #d4a843, #c9a84c)'
            : 'rgba(255,255,255,0.1)',
        }}
        role="switch"
        aria-checked={checked}
      >
        <motion.div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
          animate={{ x: checked ? '22px' : '2px' }}
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        />
      </button>
    </div>
  )
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('audio')
  const [settings, setSettings] = useState({
    noiseCancellation: true,
    echoCancellation: true,
    hd: true,
    mirrorCamera: false,
    reducedMotion: false,
    soundEffects: true,
    joinAlerts: true,
    chatNotifications: false,
  })

  const set = (key: keyof typeof settings) => (val: boolean) =>
    setSettings((s) => ({ ...s, [key]: val }))

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      variants={modalOverlay}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-lg"
        variants={modalContent}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(10,10,22,0.97)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#c9a84c]" />
              <h2 className="font-display font-bold text-[#f0f0f4]">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#5a5a72] hover:text-[#9090a8] hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 py-2 border-b border-white/[0.06]">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    background: active ? 'rgba(201,168,76,0.1)' : 'transparent',
                    color: active ? '#c9a84c' : '#5a5a72',
                    border: active ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-1 divide-y divide-white/[0.05]">
            {activeTab === 'audio' && (
              <>
                <Toggle
                  label="Noise cancellation"
                  description="Filter background noise from your mic"
                  checked={settings.noiseCancellation}
                  onChange={set('noiseCancellation')}
                />
                <Toggle
                  label="Echo cancellation"
                  description="Remove echo from your audio"
                  checked={settings.echoCancellation}
                  onChange={set('echoCancellation')}
                />
                <Toggle
                  label="Sound effects"
                  description="Play audio cues for join/leave events"
                  checked={settings.soundEffects}
                  onChange={set('soundEffects')}
                />
              </>
            )}

            {activeTab === 'video' && (
              <>
                <Toggle
                  label="HD video"
                  description="Use higher quality video (uses more bandwidth)"
                  checked={settings.hd}
                  onChange={set('hd')}
                />
                <Toggle
                  label="Mirror camera"
                  description="Flip your camera view locally"
                  checked={settings.mirrorCamera}
                  onChange={set('mirrorCamera')}
                />
              </>
            )}

            {activeTab === 'appearance' && (
              <Toggle
                label="Reduce motion"
                description="Minimize animations across the interface"
                checked={settings.reducedMotion}
                onChange={set('reducedMotion')}
              />
            )}

            {activeTab === 'notifications' && (
              <>
                <Toggle
                  label="Join alerts"
                  description="Notify when someone joins or leaves"
                  checked={settings.joinAlerts}
                  onChange={set('joinAlerts')}
                />
                <Toggle
                  label="Chat notifications"
                  description="Show badge when new messages arrive"
                  checked={settings.chatNotifications}
                  onChange={set('chatNotifications')}
                />
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-white/[0.07]">
            <p className="text-xs text-[#3a3a50] text-center">
              Settings are saved automatically · Some changes take effect on next join
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
