"use client";

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    href: '/admin',
    label: 'Tableau de bord',
    description: 'Vue d’ensemble',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 13h8V3H3v10zm10 8h8v-6h-8v6zm0-8h8V3h-8v10zM3 21h8v-6H3v6z" />
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Utilisateurs',
    description: 'Statistiques comptes',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.121 17.804A9 9 0 1119.5 9m-4.5-4a4 4 0 11-8 0 4 4 0 018 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19.385a3 3 0 116 0V21h-6v-1.615z" />
      </svg>
    ),
  },
];

function buildNavClasses(isActive: boolean) {
  const base = 'group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors';
  return isActive
    ? `${base} bg-brand-teal-light text-brand-teal-dark`
    : `${base} text-brand-dark hover:bg-gray-100`;
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden min-w-[260px] max-w-[260px] flex-col bg-white/95 px-6 py-8 shadow-sm ring-1 ring-gray-100 backdrop-blur lg:flex">
        <div className="flex items-center gap-3 pb-8">
          <Image src="/brand/logo/paper_logo.svg" alt="Sheet of Paper" width={32} height={32} priority />
          <div>
            <p className="text-sm font-heading font-semibold text-brand-dark">SheetOfPaper</p>
            <p className="text-xs text-brand-dark-lighter">Admin</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={buildNavClasses(isActive)}>
                <span
                  className={
                    isActive
                      ? 'text-brand-teal-dark'
                      : 'text-brand-dark/70 group-hover:text-brand-dark'
                  }
                >
                  {item.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.description && (
                    <span className="text-xs text-brand-dark-lighter">{item.description}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-gray-200 pt-6 text-sm text-brand-dark">
          <p className="text-xs text-brand-dark-lighter">Retour</p>
          <Link href="/app" className="mt-1 inline-flex items-center gap-2 text-brand-teal hover:text-brand-teal-dark">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Retour à l’application</span>
          </Link>
        </div>
      </aside>

      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/brand/logo/paper_logo.svg" alt="Sheet of Paper" width={28} height={28} priority />
            <span className="text-base font-heading font-semibold text-brand-dark">Admin</span>
          </Link>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? 'flex items-center gap-2 rounded-full bg-brand-teal text-white px-4 py-2 text-sm font-medium shadow'
                    : 'flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm text-brand-dark'
                }
              >
                <span className="text-current">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
