'use client';

const steps = [
  {
    number: '01',
    title: 'Importez votre PDF',
    description: 'Téléversez votre document PDF. Notre IA analyse le contenu et extrait les informations clés.',
    icon: '📄',
  },
  {
    number: '02',
    title: 'Génération automatique',
    description: 'Un quiz est généré automatiquement en quelques secondes avec des questions pertinentes basées sur votre document.',
    icon: '✨',
  },
  {
    number: '03',
    title: 'Partagez en direct',
    description: 'Générez un QR code ou un code de session. Vos élèves rejoignent instantanément sans compte.',
    icon: '📱',
  },
  {
    number: '04',
    title: 'Suivez en temps réel',
    description: 'Visualisez les réponses en direct sur votre tableau de bord et corrigez instantanément.',
    icon: '📊',
  },
];

export default function HowItWorks() {
  return (
    <section id="comment-ca-marche" className="relative py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-brand-dark mb-4 md:mb-6">
            Comment ça marche
          </h2>
          <p className="text-base md:text-xl text-brand-dark-lighter">
            En 4 étapes simples, créez et animez vos quiz interactifs
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 md:gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-2xl border border-white/50 bg-white/30 p-6 shadow-[0_20px_60px_-25px_rgba(51,51,51,0.45)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-2 hover:border-white/80 hover:bg-white/40"
            >
              <div className="absolute -top-5 -left-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-lg font-bold text-brand-dark shadow-[0_10px_25px_-12px_rgba(51,51,51,0.45)]">
                {step.number}
              </div>
              <div className="text-4xl md:text-5xl mb-4">{step.icon}</div>
              <h3 className="text-lg md:text-xl font-semibold text-brand-dark mb-2 md:mb-3">{step.title}</h3>
              <p className="text-sm md:text-base text-brand-dark-lighter leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center md:mt-16">
          <a
            href="/signup"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-gradient-to-r from-brand-yellow via-brand-yellow-dark to-brand-teal px-8 py-3 text-base font-semibold text-brand-dark shadow-[0_20px_40px_-20px_rgba(251,191,29,0.65)] transition duration-300 hover:scale-[1.02] hover:shadow-[0_28px_60px_-24px_rgba(45,143,111,0.55)] md:min-h-[56px] md:px-10 md:text-lg"
          >
            Commencer maintenant
          </a>
        </div>
      </div>
    </section>
  );
}

