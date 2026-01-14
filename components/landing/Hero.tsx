"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_STORAGE_KEYS } from "@/lib/constants";

type Shape = {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  hue: number;
};

const SHAPE_COUNT = 32;

export default function Hero() {
  const [isTransforming, setIsTransforming] = useState(false);
  const [hasDemoCompleted, setHasDemoCompleted] = useState(false);
  const router = useRouter();
  const shapesPalette = useMemo<Shape[]>(() => {
    return Array.from({ length: SHAPE_COUNT }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 16 + 12,
      duration: Math.random() * 12 + 16,
      delay: Math.random() * 4,
      hue: 40 + Math.random() * 120,
    }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const completed = window.localStorage.getItem(ONBOARDING_STORAGE_KEYS.demoCompleted) === "true";
    setHasDemoCompleted(completed);
  }, []);

  useEffect(() => {
    setIsTransforming(true);
    let animationTimeout: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => setIsTransforming(false),
      2600,
    );

    const intervalId = setInterval(() => {
      setIsTransforming(true);
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
      animationTimeout = setTimeout(() => setIsTransforming(false), 2600);
    }, 5200);

    return () => {
      clearInterval(intervalId);
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
    };
  }, []);

  const handleStartClick = useCallback(() => {
    const alreadyCompleted =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ONBOARDING_STORAGE_KEYS.demoCompleted) === "true"
        : hasDemoCompleted;

    if (!alreadyCompleted) {
      router.push("/demo");
      return;
    }

    router.push("/signup");
  }, [hasDemoCompleted, router]);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-28 md:pt-24">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-yellow/50 via-white/20 to-brand-teal/40 blur-3xl opacity-80 animate-[spin_60s_linear_infinite]" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[380px] w-[380px] rounded-full bg-gradient-to-br from-white/10 via-brand-teal/30 to-brand-yellow/40 blur-3xl opacity-70 animate-[spin_48s_linear_reverse_infinite]" />
        <div className="absolute top-1/3 left-[-120px] h-[320px] w-[320px] rounded-full bg-gradient-to-tr from-brand-teal/30 via-white/10 to-brand-yellow/20 blur-3xl opacity-60 animate-[pulse_16s_ease-in-out_infinite]" />
        {shapesPalette.map((shape, index) => (
          <div
            key={`${shape.x}-${index}`}
            className="pointer-events-none absolute rounded-full bg-white/10 backdrop-blur-3xl"
            style={{
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              width: `${shape.size}px`,
              height: `${shape.size}px`,
              animation: `float-bubble ${shape.duration}s ease-in-out ${shape.delay}s infinite`,
              background: `linear-gradient(135deg, hsla(${shape.hue}, 80%, 70%, 0.35), hsla(${shape.hue + 20}, 85%, 60%, 0.2))`,
              boxShadow: "0 10px 40px rgba(69, 191, 154, 0.15)",
            }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.6),_transparent_65%)]" />
      </div>

      <div className="container relative z-20 mx-auto flex max-w-6xl flex-col items-center gap-12 px-4">
        <div className="w-full max-w-4xl rounded-[40px] border border-white/40 bg-white/25 p-8 shadow-[0_25px_120px_-40px_rgba(51,51,51,0.55)] backdrop-blur-[28px] transition duration-500 hover:border-white/60 hover:bg-white/30 md:p-12">
          <div className="flex flex-col items-center gap-8 text-center md:gap-10">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-center gap-3 text-brand-dark">
                <span className="text-3xl font-heading font-semibold sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">Etudiez</span>
                <span className="relative inline-flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-brand-yellow/70 blur-3xl opacity-70" />
                  <span className="relative text-3xl font-heading font-semibold sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">mieux</span>
                </span>
                <div className="relative h-14 w-14 flex-shrink-0 sm:h-16 sm:w-16 md:h-20 md:w-20 lg:h-24 lg:w-24">
                  <Image
                    src="/images/pdf.png"
                    alt="PDF"
                    width={120}
                    height={120}
                    className={`absolute inset-0 h-full w-full object-contain transition-all ease-in-out ${
                      isTransforming ? "scale-75 opacity-0 blur-sm" : "scale-100 opacity-100"
                    }`}
                    style={{ transitionDuration: '2500ms' }}
                    priority
                    unoptimized
                  />
                  <Image
                    src="/images/quiz.png"
                    alt="Quiz"
                    width={120}
                    height={120}
                    className={`absolute inset-0 h-full w-full object-contain transition-all ease-in-out ${
                      isTransforming ? "scale-100 opacity-100" : "-translate-y-4 scale-75 opacity-0"
                    }`}
                    style={{ transitionDuration: '2500ms' }}
                    priority
                    unoptimized
                  />
                </div>
                <span className="text-3xl font-heading font-semibold sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">avec</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-brand-dark">
                <span className="relative inline-flex text-3xl font-heading uppercase tracking-[0.4em] sm:text-4xl md:text-5xl">
                  l&apos;IA
                  <span className="absolute -bottom-3 left-0 right-0 h-2 rounded-full bg-gradient-to-r from-brand-yellow/80 via-white/50 to-brand-teal/70 blur" />
                </span>
              </div>
            </div>

            <p className="max-w-2xl text-base text-brand-dark-lighter sm:text-lg md:text-xl lg:text-2xl">
              Transformez vos documents en quiz interactifs et révisez efficacement avec l&apos;intelligence artificielle.
            </p>

            <div className="flex w-full flex-col items-center justify-center">
              <button
                type="button"
                onClick={handleStartClick}
                className="group flex min-h-[48px] items-center justify-center rounded-full bg-gradient-to-r from-brand-yellow via-brand-yellow-dark to-brand-teal px-10 py-3 text-base font-semibold text-brand-dark shadow-[0_20px_40px_-20px_rgba(251,191,29,0.65)] transition duration-300 hover:scale-[1.02] hover:shadow-[0_30px_60px_-24px_rgba(45,143,111,0.55)] md:min-h-[56px] md:px-12 md:text-lg"
              >
                Commencer
              </button>
            </div>

            <p className="text-xs uppercase tracking-[0.3em] text-brand-dark-lighter md:text-sm">
              Sans carte bancaire • Accès immédiat
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

