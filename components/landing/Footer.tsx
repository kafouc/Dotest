'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-brand-dark text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/brand/logo/paper_logo.svg"
                alt="Sheet of Paper"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <h3 className="text-2xl font-heading font-bold">Sheet of Paper</h3>
            </div>
            <p className="text-gray-400">
              La plateforme de quiz en temps réel pour enseignants et formateurs.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Produit</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a href="#comment-ca-marche" className="hover:text-white transition-colors">
                  Comment ça marche
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Tarifs
                </a>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  Application
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Ressources</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="mailto:kafoumathieu.coulibaly@gmail.com" className="hover:text-white transition-colors">
                  Support
                </a>
              </li>
              <li>
                <a href="mailto:kafoumathieu.coulibaly@gmail.com" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">À propos</h4>
            <p className="text-gray-400 mb-2">
              Conçu par <strong className="text-white">Mathieu Coulibaly</strong>, développeur Full‑Stack.
            </p>
            <a
              href="mailto:kafoumathieu.coulibaly@gmail.com"
              className="text-brand-yellow hover:text-brand-yellow-light transition-colors"
            >
              kafoumathieu.coulibaly@gmail.com
            </a>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8 text-center text-gray-400">
          <p>&copy; {currentYear} Sheet of Paper. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}

