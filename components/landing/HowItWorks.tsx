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
    <section id="comment-ca-marche" className="py-12 md:py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-brand-dark mb-3 md:mb-4">
            Comment ça marche
          </h2>
          <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            En 4 étapes simples, créez et animez vos quiz interactifs
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative p-5 md:p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
            >
              <div className="absolute -top-3 -left-3 w-10 h-10 md:w-12 md:h-12 bg-brand-yellow rounded-full flex items-center justify-center text-lg md:text-2xl font-bold text-brand-dark">
                {step.number}
              </div>
              <div className="text-4xl md:text-5xl mb-3 md:mb-4">{step.icon}</div>
              <h3 className="text-lg md:text-xl font-semibold text-brand-dark mb-2 md:mb-3">{step.title}</h3>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8 md:mt-12">
          <a
            href="/signup"
            className="inline-block px-6 md:px-8 py-3 md:py-4 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full text-base md:text-lg transition-all duration-200 min-h-[44px]"
            style={{ backgroundColor: '#fbbf1d' }}
          >
            Commencer maintenant
          </a>
        </div>
      </div>
    </section>
  );
}

