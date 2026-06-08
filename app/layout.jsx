import './globals.css';
import { Cinzel, Lora, Nunito } from 'next/font/google';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['400', '600', '700', '900'], variable: '--font-cinzel' });
const lora = Lora({ subsets: ['latin'], weight: ['400', '600', '700'], style: ['normal', 'italic'], variable: '--font-lora' });
const nunito = Nunito({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'], variable: '--font-nunito' });

export const metadata = {
  title: 'Noorul Academy',
  description: 'Noorul Academy online Quran and Tajweed learning platform.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${lora.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
