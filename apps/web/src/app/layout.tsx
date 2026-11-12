import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { AuthProvider } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ApiStartupGate from '../components/ApiStartupGate';

export const metadata: Metadata = {
  title: 'Usta Bul — En Yakın ve Güvenilir Ustalar',
  description: 'Tesisatçı, elektrikçi, boyacı, marangoz ve tamir ustalarını konumunuza göre bulun, teklif alın.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <AuthProvider>
          <ApiStartupGate>
            <Navbar />
            <main>{children}</main>
            <footer className="footer">
              <div className="container footer-content">
                <div className="footer-brand">
                  <span className="logo-mark" style={{ width: 24, height: 24, borderRadius: 7, fontSize: '0.7rem' }}>
                    U
                  </span>
                  <span>Usta Bul</span>
                </div>
                <p style={{ maxWidth: '42ch', margin: 0 }}>
                  Doğrulanmış, puanlanmış profesyonel ustalarla güvenilir hizmet pazaryeri.
                </p>
                <span>© 2026 Usta Bul</span>
              </div>
            </footer>
          </ApiStartupGate>
        </AuthProvider>
      </body>
    </html>
  );
}
