"use client";

import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { Download, Github, Zap } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  const { t } = useLanguage();

  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-accent/10 blur-[120px] rounded-full opacity-50" />
      </div>

      <div className="container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 bg-white/5 text-white text-sm font-medium mb-8"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>{t.hero.tag}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500"
        >
          {t.hero.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg lg:text-xl text-zinc-400 max-w-2xl mx-auto mb-10"
        >
          {t.hero.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="https://github.com/OneMoreJack/TalkingCut/releases/download/v0.0.1/TalkingCut-0.0.1-mac-arm64.dmg"
            className="flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black font-semibold hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <Download className="w-5 h-5" />
            {t.hero.download}
          </Link>
          <Link
            href="https://github.com/OneMoreJack/TalkingCut"
            target="_blank"
            className="flex items-center gap-2 px-8 py-4 rounded-full glass font-semibold hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
          >
            <Github className="w-5 h-5" />
            {t.hero.github}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
