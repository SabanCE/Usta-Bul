'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SessionEndedPage() {
  const router = useRouter();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      router.replace('/login?session=ended');
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [router]);

  return (
    <main className="auth-wrap">
      <section className="auth-card" role="status" aria-live="polite">
        <h1 className="auth-title">Oturumunuz sonlandırıldı</h1>
        <p className="auth-subtitle">
          Güvenliğiniz için oturumunuz kapatıldı. Giriş sayfasına yönlendiriliyorsunuz.
        </p>
        <Link href="/login?session=ended" className="btn btn-primary btn-block mt-2">
          Giriş yap
        </Link>
      </section>
    </main>
  );
}
