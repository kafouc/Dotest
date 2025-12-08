'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[70%] max-w-7xl">
      <nav
        className={`rounded-full px-6 py-4 flex items-center justify-between transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-lg border border-gray-200'
            : 'bg-white/80 backdrop-blur-sm shadow-md border border-gray-100'
        }`}
      >
        {/* Logo, nom et navigation à gauche */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo/paper_logo.svg"
              alt="Sheet of Paper"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
            <span className="text-xl font-heading font-bold text-brand-dark" style={{ fontFamily: 'var(--font-unbounded), sans-serif' }}>SheetOfPaper</span>
          </Link>
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
        </div>

        {/* Boutons login et sign up à droite */}
        <div className="flex items-center gap-3">
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
      </nav>
    </header>
  );
}

