"use client";

import Features from "@/components/Features";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar";
import VideoPlayer from "@/components/VideoPlayer";
import { useLanguage } from "@/context/LanguageContext";

export default function Home() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-black selection:bg-accent/30 selection:text-accent font-sans antialiased text-white">
      <Navbar />
      <Hero />
      <VideoPlayer />
      <Features />
      <HowItWorks />
      
      {/* Footer */}
      <footer className="py-12 border-t border-zinc-900 bg-zinc-950/50">
        <div className="container mx-auto px-6 text-center">
          <p className="text-zinc-500 text-sm">
            {t.footer.text}
          </p>
        </div>
      </footer>
    </main>
  );
}
