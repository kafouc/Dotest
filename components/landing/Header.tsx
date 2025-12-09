'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import InstallPWAButton from '@/components/InstallPWAButton';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] md:w-[80%] lg:w-[70%] max-w-7xl">
        <nav
          className={`rounded-full px-4 md:px-6 py-3 md:py-4 flex items-center justify-between transition-all duration-300 ${
            isScrolled
              ? 'bg-white/95 backdrop-blur-md shadow-lg border border-gray-200'
              : 'bg-white/80 backdrop-blur-sm shadow-md border border-gray-100'
          }`}
        >
          {/* Logo et nom */}
          <Link href="/" className="flex items-center gap-2 md:gap-3 z-10">
            <Image
              src="/brand/logo/paper_logo.svg"
              alt="Sheet of Paper"
              width={32}
              height={32}
              className="h-7 md:h-8 w-auto"
            />
            <span className="text-base md:text-xl font-heading font-bold text-brand-dark hidden sm:inline" style={{ fontFamily: 'var(--font-unbounded), sans-serif' }}>SheetOfPaper</span>
          </Link>

          {/* Navigation desktop (lg+) */}
          <div className="hidden lg:flex items-center gap-6">
            <a
              href="#comment-ca-marche"
              className="text-sm font-body text-gray-700 hover:text-brand-yellow transition-colors"
            >
              Comment ça marche
            </a>
            <a
              href="#pricing"
              className="text-sm font-body text-gray-700 hover:text-brand-yellow transition-colors"
            >
              Tarifs
            </a>
            <a
              href="#faq"
              className="text-sm font-body text-gray-700 hover:text-brand-yellow transition-colors"
            >
              FAQ
            </a>
          </div>

          {/* Actions desktop (lg+) */}
          <div className="hidden lg:flex items-center gap-3">
            <InstallPWAButton className="" />
            <a
              href="/login"
              className="px-5 py-2 text-sm font-body text-brand-yellow hover:text-brand-yellow-dark transition-colors"
            >
              Login
            </a>
            <a
              href="/signup"
              className="px-5 py-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full transition-all duration-200"
              style={{ backgroundColor: '#fbbf1d' }}
            >
              Sign Up
            </a>
          </div>

          {/* Burger menu button (mobile/tablet) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:text-brand-yellow transition-colors z-10"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>
      </header>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[280px] bg-white shadow-2xl z-50 transform transition-transform duration-300 lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-lg font-heading font-bold text-brand-dark">Menu</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-gray-700 hover:text-brand-yellow transition-colors"
              aria-label="Fermer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-4">
            <a
              href="#comment-ca-marche"
              className="block text-base font-body text-gray-700 hover:text-brand-yellow transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Comment ça marche
            </a>
            <a
              href="#pricing"
              className="block text-base font-body text-gray-700 hover:text-brand-yellow transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Tarifs
            </a>
            <a
              href="#faq"
              className="block text-base font-body text-gray-700 hover:text-brand-yellow transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              FAQ
            </a>
          </nav>

          <div className="pt-6 border-t border-gray-200 space-y-3">
            <InstallPWAButton className="w-full justify-center" />
            <a
              href="/login"
              className="block w-full px-5 py-3 text-center text-base font-body text-brand-yellow hover:text-brand-yellow-dark transition-colors border border-brand-yellow rounded-full"
            >
              Login
            </a>
            <a
              href="/signup"
              className="block w-full px-5 py-3 text-center bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full transition-all duration-200"
              style={{ backgroundColor: '#fbbf1d' }}
            >
              Sign Up
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

