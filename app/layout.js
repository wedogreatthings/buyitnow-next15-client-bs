import { Suspense } from 'react';
import dynamic from 'next/dynamic';

import '@/app/globals.css';

import { GlobalProvider } from './GlobalProvider';
import Header from '@/components/layouts/Header';
import Head from './head';
const Footer = dynamic(() => import('@/components/layouts/Footer'));

// Import dynamique du gestionnaire de Service Worker
const ServiceWorkerManager = dynamic(() =>
  import('@/components/utils/ServiceWorkerManager'),
);

// Création d'une constante réutilisable
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://buyitnow-client-n15-prv1.vercel.app';

// Métadonnées globales pour le site
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Buy It Now',
    template: '%s | Buy It Now',
  },
  description:
    'Boutique en ligne simplifiée (BS), Buy It Now est la solution pour acheter et vendre facilement sur Internet.',
  keywords: [
    'e-commerce',
    'shopping',
    'online store',
    'products',
    'Buy It Now',
    'BS',
    'boutique en ligne',
    "solution d'achat",
  ],
  referrer: 'origin-when-cross-origin',
  authors: [{ name: 'Benew Team' }],
  creator: 'Benew Team',
  publisher: 'Benew',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    noimageindex: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: SITE_URL,
    title: 'Buy It Now',
    description:
      'Boutique en ligne simplifiée (BS), Buy It Now est la solution pour acheter et vendre facilement sur Internet.',
    siteName: 'BS - Buy It Now',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buy It Now',
    description: 'Boutique en ligne simplifiée (BS), Buy It Now',
    creator: '@benew',
    site: '@benew',
  },
  manifest: './manifest.json',
};

// app/layout.js - ajouter cet export
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <Head />
      <body className="flex flex-col min-h-screen bg-gray-50">
        <GlobalProvider>
          <ServiceWorkerManager />
          <Suspense>
            <Header />
          </Suspense>
          <main className="flex-grow">{children}</main>
          <Footer />
        </GlobalProvider>
      </body>
    </html>
  );
}
