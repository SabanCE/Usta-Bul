'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import SupportCenter from '../../components/SupportCenter';

export default function SupportPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'customer' && user.role !== 'artisan')) {
      router.replace(user?.role === 'admin' ? '/admin-dashboard' : '/login');
    }
  }, [loading, user, router]);

  if (loading || !user || (user.role !== 'customer' && user.role !== 'artisan')) {
    return <div className="page"><div className="container"><div className="loading-text">Destek paneli yükleniyor...</div></div></div>;
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="eyebrow">{user.role === 'artisan' ? 'Usta paneli' : 'Müşteri paneli'}</p>
            <h1 className="page-title">Destek ve yardım</h1>
            <p className="page-subtitle">Destek ekibiyle iletişime geçin ve şikâyetlerinizin durumunu takip edin.</p>
          </div>
          <Link href={user.role === 'artisan' ? '/artisan-dashboard' : '/requests'} className="btn btn-secondary">
            Panele dön
          </Link>
        </div>
        <SupportCenter />
      </div>
    </div>
  );
}
