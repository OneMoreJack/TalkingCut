"use client";

import { useLanguage } from "@/context/LanguageContext";
import { Github, Languages } from "lucide-react";
import Link from "next/link";

export default function Navbar() {
  const { language, setLanguage } = useLanguage();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 lg:px-12 glass border-none">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center font-bold text-black shadow-[0_0_15px_rgba(255,255,255,0.5)]">
          T
        </div>
        <span className="text-xl font-bold tracking-tight text-white">TalkingCut</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLanguage(language === "en" ? "cn" : "en")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full glass hover:bg-white/10 transition-colors text-sm font-medium text-zinc-300 hover:text-white"
        >
          <Languages className="w-4 h-4" />
          <span>{language === "en" ? "中文" : "English"}</span>
        </button>
        
        <Link 
          href="https://github.com/OneMoreJack/TalkingCut" 
          target="_blank"
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-300 hover:text-white"
        >
          <Github className="w-6 h-6" />
        </Link>
      </div>
    </nav>
  );
}
