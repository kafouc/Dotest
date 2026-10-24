'use client';

import { useEffect } from 'react';
import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';
import { trackPageView } from '@/lib/trackPageView';

export default function Home() {
  useEffect(() => {
    trackPageView('/');
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-brand-yellow-light/40 to-brand-teal-light/40 text-brand-dark">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-16 h-[460px] w-[460px] rounded-full bg-gradient-to-br from-brand-yellow/45 via-white/35 to-brand-teal/35 blur-[120px] opacity-70 animate-[spin_90s_linear_infinite]" />
        <div className="absolute bottom-[-220px] left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-brand-teal/35 via-white/20 to-brand-yellow/35 blur-[120px] opacity-65 animate-[spin_72s_linear_reverse_infinite]" />
        <div className="absolute top-1/3 right-[-140px] h-[440px] w-[440px] rounded-full bg-gradient-to-br from-white/10 via-brand-yellow/35 to-brand-teal/25 blur-[120px] opacity-60 animate-[pulse_24s_ease-in-out_infinite]" />
      </div>

      <Header />
      <Hero />

      <div className="section-gradient section-gradient--emerald">
        <HowItWorks />
      </div>

      <div className="section-gradient section-gradient--sunrise">
        <Pricing />
      </div>

      <div className="section-gradient section-gradient--emerald">
        <FAQ />
      </div>

      <div className="section-gradient section-gradient--midnight">
        <CTA />
      </div>

      <Footer />
    </main>
  );
}
