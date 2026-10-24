'use client';

export default function CTA() {
  return (
    <section className="relative py-20 md:py-24">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-[34px] border border-white/40 bg-gradient-to-r from-brand-yellow/90 via-brand-yellow-dark/80 to-brand-teal/90 p-10 text-center shadow-[0_30px_90px_-40px_rgba(51,51,51,0.6)] backdrop-blur-2xl md:p-14">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/30 blur-3xl opacity-70" />
          <div className="pointer-events-none absolute bottom-[-90px] right-[-60px] h-60 w-60 rounded-full bg-white/20 blur-3xl opacity-60" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-brand-dark mb-6">
              Prêt à transformer vos cours ?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base text-brand-dark md:text-xl">
              Enseignants, formateurs et étudiants : générez un quiz à partir de vos documents ou révisez vos cours avec des quiz et des flashcards espacées.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="/signup"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white/90 px-8 py-3 text-base font-semibold text-brand-dark shadow-[0_18px_42px_-22px_rgba(255,255,255,0.8)] transition duration-300 hover:scale-[1.02] hover:bg-white"
              >
                Créer un quiz maintenant
              </a>
              <a
                href="mailto:kafoumathieu.coulibaly@gmail.com"
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/80 bg-white/20 px-8 py-3 text-base font-semibold text-brand-dark shadow-[0_18px_48px_-24px_rgba(0,0,0,0.35)] transition duration-300 hover:border-white hover:bg-white/30"
              >
                Demander une démo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

