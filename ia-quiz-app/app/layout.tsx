import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IA Quiz App',
  description: 'Générez des quiz à partir de vos cours',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${inter.className} 
                       bg-gradient-to-r from-gradient-start via-gradient-middle to-gradient-end 
                       bg-[length:200%_200%] bg-no-repeat bg-cover bg-fixed animate-gradient-background
                       min-h-screen text-gray-900`}
      >
        {children}
      </body>
    </html>
  )
}