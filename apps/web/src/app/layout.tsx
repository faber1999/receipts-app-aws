import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, Source_Serif_4 } from 'next/font/google';
import { AmplifyConfig } from '@/components/amplify-config';
import { MAIN_CONTENT_ID, SiteFooter, SiteHeader, SkipLink } from '@/components/site-shell';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { I18nProvider } from '@/i18n/i18n-provider';
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
    'Upload a photo of a receipt and AI extracts the merchant, total, date and category. Track spending by category and get a monthly summary.',
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
    <html lang={DEFAULT_LOCALE} className={`${uiFont.variable} ${serifFont.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <AmplifyConfig />
        <I18nProvider>
          <SkipLink />
          <SiteHeader />
          <main
            id={MAIN_CONTENT_ID}
            className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16"
          >
            {children}
          </main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
