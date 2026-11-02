import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, Source_Serif_4 } from 'next/font/google';
import Link from 'next/link';
import { AmplifyConfig } from '@/components/amplify-config';
import { BrandMark } from '@/components/brand-mark';
import './globals.css';

const uiFont = Instrument_Sans({
  variable: '--font-ui',
  subsets: ['latin'],
  display: 'swap',
});

const serifFont = Source_Serif_4({
  variable: '--font-serif',
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Receipts App',
    template: '%s · Receipts App',
  },
  description:
    'Sube la foto de un recibo y la IA extrae comercio, total, fecha y categoría. Consulta tus gastos por categoría y recibe un resumen mensual.',
  applicationName: 'Receipts App',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1311' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${uiFont.variable} ${serifFont.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <AmplifyConfig />
        <a
          href="#contenido"
          className="sr-only rounded-md bg-surface px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Saltar al contenido
        </a>
        <header className="border-b border-line">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-ink no-underline"
              aria-label="Receipts App, inicio"
            >
              <BrandMark />
              <span className="text-[0.9375rem] font-semibold tracking-tight">Receipts App</span>
            </Link>
          </div>
        </header>
        <main id="contenido" className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:justify-between sm:px-6">
            <p>Receipts App</p>
            <p>Proyecto de portafolio construido sobre AWS.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
