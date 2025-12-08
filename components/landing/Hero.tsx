'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export default function Hero() {
  const [isTransforming, setIsTransforming] = useState(false);
  const [shapes, setShapes] = useState<Array<{ type: 'square' | 'circle' | 'triangle'; x: number; y: number; size: number; delay: number }>>([]);

  useEffect(() => {
    // Générer des formes géométriques aléatoires pour le background
    const generateShapes = () => {
      const newShapes: Array<{ type: 'square' | 'circle' | 'triangle'; x: number; y: number; size: number; delay: number }> = [];
      const types: ('square' | 'circle' | 'triangle')[] = ['square', 'circle', 'triangle'];
      
      for (let i = 0; i < 50; i++) {
        newShapes.push({
          type: types[Math.floor(Math.random() * types.length)],
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 8 + 4, // Entre 4px et 12px
          delay: Math.random() * 2,
        });
      }
      setShapes(newShapes);
    };

    generateShapes();

    // Animation de transformation PDF → Card
    const interval = setInterval(() => {
      setIsTransforming(true);
      setTimeout(() => setIsTransforming(false), 3000);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background avec formes géométriques */}
      <div className="absolute inset-0 bg-gray-50">
        {shapes.map((shape, index) => (
          <div
            key={index}
            className={`absolute hero-shape ${
              shape.type === 'square' 
                ? 'bg-brand-dark' 
                : shape.type === 'circle' 
                ? 'bg-brand-dark rounded-full' 
                : 'bg-brand-dark'
            } opacity-10`}
            style={{
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              width: `${shape.size}px`,
              height: `${shape.size}px`,
              animationDelay: `${shape.delay}s`,
              clipPath: shape.type === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'none',
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center justify-center gap-12">
          {/* Texte principal */}
          <div className="text-center max-w-5xl mx-auto">
            <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-heading font-bold text-brand-dark mb-8 leading-tight">
              <div className="flex items-center justify-center gap-3 md:gap-4 flex-wrap">
                <span className="block">Etudiez</span>
                <span className="block">mieux</span>
                {/* Animation PDF → Card */}
                <div className="relative w-20 h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 flex-shrink-0">
                  {/* PDF */}
                  <Image
                    src="/images/pdf.png"
                    alt="PDF"
                    width={120}
                    height={120}
                    className={`absolute inset-0 w-full h-full object-contain transition-all duration-2500 ease-in-out ${
                      isTransforming 
                        ? 'opacity-0 scale-75 rotate-12 translate-x-4' 
                        : 'opacity-100 scale-100 rotate-0 translate-x-0'
                    }`}
                    priority
                    unoptimized
                  />
                  {/* Quiz Card */}
                  <Image
                    src="/images/quiz.png"
                    alt="Quiz"
                    width={120}
                    height={120}
                    className={`absolute inset-0 w-full h-full object-contain transition-all duration-2500 ease-in-out ${
                      isTransforming 
                        ? 'opacity-100 scale-100 rotate-0 translate-x-0' 
                        : 'opacity-0 scale-75 -rotate-12 -translate-x-4'
                    }`}
                    priority
                    unoptimized
                  />
                </div>
                <span className="block">avec</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="block relative">
                  l&apos;ia
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 md:h-1 bg-brand-yellow transform -skew-x-12"></span>
                </span>
              </div>
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Transformez vos documents en quiz interactifs et révisez efficacement avec l&apos;intelligence artificielle.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/signup"
                className="px-8 py-4 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full text-lg transition-all duration-200"
                style={{ backgroundColor: '#fbbf1d' }}
              >
                Essayer gratuitement
              </a>
              <a
                href="#comment-ca-marche"
                className="px-8 py-4 bg-white hover:bg-gray-50 text-brand-dark font-semibold rounded-full text-lg transition-all duration-200 border-2 border-brand-yellow"
              >
                Découvrir
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

