import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '../components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'FashionAI — Trend Analysis',
  description: 'AI-powered fashion trend detection platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-950 text-gray-100 antialiased">
        <Sidebar />
        <div className="pl-60">
          <main className="min-h-screen p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
