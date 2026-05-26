import { LandingNav } from '@/components/landing/nav'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CTA, Footer } from '@/components/landing/cta'
import { AmbientBackground } from '@/components/ui/ambient-background'

export default function LandingPage() {
  return (
    <main className="relative min-h-screen">
      <AmbientBackground variant="landing" />

      <div className="relative z-10 min-h-screen">
        <LandingNav />
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
        <Footer />
      </div>
    </main>
  )
}
