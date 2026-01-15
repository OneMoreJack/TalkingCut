"use client";

export default function VideoPlayer() {
  return (
    <section className="pb-20 lg:pb-32">
      <div className="container mx-auto px-6">
        <div className="relative mx-auto max-w-5xl group cursor-pointer">
          {/* Decorative shadows/glows */}
          <div className="absolute -inset-1 bg-gradient-to-r from-white/20 to-zinc-400/20 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-500" />
          
          <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-2xl bg-zinc-900 aspect-[3/2] flex items-center justify-center">
            <video
              src="/demo.mp4"
              className="w-full h-full object-contain"
              autoPlay
              muted
              loop
              playsInline
            />
          </div>
        </div>
      </div>
    </section>
  );
}