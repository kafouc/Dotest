'use client';

export default function CTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-brand-yellow to-brand-teal">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-heading font-bold text-white mb-6">
          Prêt à transformer vos cours ?
        </h2>
        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          Enseignants, formateurs et étudiants : générez un quiz à partir de vos documents ou révisez vos cours avec des quiz et des flashcards espacées.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/signup"
            className="px-8 py-4 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full text-lg transition-all duration-200"
            style={{ backgroundColor: '#fbbf1d' }}
          >
            Créer un quiz maintenant
          </a>
          <a
            href="mailto:kafoumathieu.coulibaly@gmail.com"
            className="px-8 py-4 bg-transparent hover:bg-brand-yellow/20 text-white font-semibold rounded-full text-lg transition-all duration-200 border-2 border-brand-yellow"
          >
            Demander une démo
          </a>
        </div>
      </div>
    </section>
  );
}

