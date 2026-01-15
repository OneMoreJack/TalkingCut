"use client";

import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { BarChart3, Coins, Cpu, MousePointerClick, Target, Zap } from "lucide-react";

const icons = [Zap, Target, Coins, Cpu, MousePointerClick, BarChart3];
const colors = [
  { text: "text-zinc-100", bg: "bg-white/10" },
  { text: "text-zinc-300", bg: "bg-white/5" },
  { text: "text-zinc-400", bg: "bg-white/5" },
  { text: "text-zinc-100", bg: "bg-white/10" },
  { text: "text-zinc-300", bg: "bg-white/5" },
  { text: "text-zinc-400", bg: "bg-white/5" },
];

export default function Features() {
  const { t } = useLanguage();

  return (
    <section className="py-20 lg:py-32 bg-zinc-950">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">{t.features.title}</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            {t.features.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {t.features.items.map((feature, index) => {
            const Icon = icons[index % icons.length];
            const color = colors[index % colors.length];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="p-8 rounded-2xl glass hover:border-accent/30 transition-colors group"
              >
                <div className={`w-12 h-12 rounded-xl ${color.bg} ${color.text} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
