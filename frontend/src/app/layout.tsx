import type { Metadata } from 'next';
import { Archivo_Black, Space_Grotesk } from 'next/font/google';

import './globals.css';

const archivoBlack = Archivo_Black({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: '400',
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Share your feedback.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
