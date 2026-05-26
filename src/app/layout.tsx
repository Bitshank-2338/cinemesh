import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CineMesh — Watch Together, Feel Together',
  description: 'The cinematic watch party platform. Sync your screen, invite your crew, and experience movies together — no matter where you are.',
  keywords: ['watch party', 'sync watch', 'watch together', 'movie night', 'stream together'],
  openGraph: {
    title: 'CineMesh — Watch Together, Feel Together',
    description: 'The cinematic watch party platform for friends.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#06060e',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${dmSerifDisplay.variable}`}
    >
      <body className="bg-[#06060e] text-[#f0f0f4] antialiased">
        {children}
      </body>
    </html>
  )
}
