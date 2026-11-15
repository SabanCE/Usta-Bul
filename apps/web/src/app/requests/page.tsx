'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiUrl, getAuthHeaders } from '../../utils/api';
import { formatCityDistrict } from '../../utils/location';

interface JobRequest {
  id: string;
  category: string;
  title: string;
  description: string;
  address: string;
  city: string | null;
  district: string | null;
  urgency: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  images: string[];
  bids_count: number;
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch(apiUrl('/api/v1/requests'), {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error?.message || 'Talepler yüklenemedi.');
        }

        setRequests(Array.isArray(data?.data) ? data.data : []);
      } catch (err: any) {
        setRequests([]);
        setErrorMsg(err?.message || 'Talepler yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const statusMap: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Teklif bekliyor', cls: 'badge-warning' },
    in_progress: { label: 'Devam ediyor', cls: 'badge-accent' },
    completed: { label: 'Tamamlandı', cls: 'badge-success' },
    cancelled: { label: 'İptal edildi', cls: 'badge-danger' },
  };

  const filtered = filterStatus === 'all' ? requests : requests.filter((r) => r.status === filterStatus);
  const totalBids = requests.reduce((total, request) => total + (Number(request.bids_count) || 0), 0);
  const activeRequests = requests.filter((request) => request.status === 'in_progress').length;
  const completedRequests = requests.filter((request) => request.status === 'completed').length;

  return (
    <main className="customer-dashboard-page">
      <div className="customer-dashboard-container">
        <section className="customer-dashboard-hero" aria-labelledby="customer-dashboard-title">
          <div className="customer-dashboard-copy">
            <span className="customer-dashboard-kicker"><i /> MÜŞTERİ PANELİ</span>
            <h1 id="customer-dashboard-title">Ev işlerinizi tek yerden <em>yönetin.</em></h1>
            <p>Ustalardan gelen teklifleri karşılaştırın, işlerinizin durumunu kolayca takip edin.</p>
            <Link href="/requests/new" className="customer-dashboard-cta">
              Yeni talep oluştur <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="customer-dashboard-art" aria-hidden="true">
            <span className="customer-dashboard-orbit customer-dashboard-orbit-one" />
            <span className="customer-dashboard-orbit customer-dashboard-orbit-two" />
            <div className="customer-dashboard-art-card">
              <span className="customer-dashboard-art-icon">⌂</span>
              <span className="customer-dashboard-art-lines"><i /><i /><i /></span>
              <span className="customer-dashboard-art-check">✓</span>
            </div>
            <span className="customer-dashboard-art-caption">İşiniz güvende</span>
          </div>
        </section>

        <section className="customer-dashboard-metrics" aria-label="Talep özeti">
          <article className="customer-metric-card">
            <span className="customer-metric-icon customer-metric-blue" aria-hidden="true">▤</span>
            <span><strong>{loading ? '—' : requests.length}</strong><small>Toplam talep</small></span>
          </article>
          <article className="customer-metric-card">
            <span className="customer-metric-icon customer-metric-teal" aria-hidden="true">↗</span>
            <span><strong>{loading ? '—' : totalBids}</strong><small>Gelen teklif</small></span>
          </article>
          <article className="customer-metric-card">
            <span className="customer-metric-icon customer-metric-amber" aria-hidden="true">◷</span>
            <span><strong>{loading ? '—' : activeRequests}</strong><small>Devam eden</small></span>
          </article>
          <article className="customer-metric-card">
            <span className="customer-metric-icon customer-metric-green" aria-hidden="true">✓</span>
            <span><strong>{loading ? '—' : completedRequests}</strong><small>Tamamlanan</small></span>
          </article>
        </section>

        <div className="customer-request-heading">
          <div>
            <span className="customer-dashboard-section-kicker">TALEPLERİNİZ</span>
            <h2>İşleriniz ve teklifler</h2>
            <p>Her talebin güncel durumu ve teklifleri burada.</p>
          </div>
          <div className="customer-request-filters" aria-label="Talepleri duruma göre filtrele">
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'pending', label: 'Teklif bekleyen' },
            { key: 'in_progress', label: 'Devam eden' },
            { key: 'completed', label: 'Tamamlanan' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key)}
              className={`tab ${filterStatus === tab.key ? 'tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
          </div>
        </div>

        {errorMsg && <div className="alert alert-error mb-3" role="alert">{errorMsg}</div>}

        {loading ? (
          <div className="customer-request-empty">
            <span className="customer-request-empty-icon" aria-hidden="true">⌁</span>
            <strong>Talepleriniz hazırlanıyor</strong>
            <p>Güncel işleriniz kısa süre içinde burada görünecek.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="customer-request-empty">
            <span className="customer-request-empty-icon" aria-hidden="true">⌂</span>
            <strong>Bu filtrede talep görünmüyor</strong>
            <p>Eviniz için bir hizmet talebi açın, size uygun ustalardan teklif alın.</p>
            <Link href="/requests/new" className="customer-dashboard-cta customer-dashboard-cta-light">
              İlk talebinizi oluştur <span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : (
          <div className="customer-request-list">
            {filtered.map((req) => {
              const st = statusMap[req.status] || statusMap.pending;
              return (
                <article key={req.id} className="customer-request-card">
                  <div className="customer-request-art" aria-hidden="true">
                    <span>{req.category === 'electrician' ? '⌁' : req.category === 'plumber' ? '≈' : req.category === 'painter' ? '▧' : '⌂'}</span>
                    <i />
                  </div>
                  <div className="customer-request-content">
                    <div className="customer-request-meta">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {req.urgency === 'urgent' && <span className="badge badge-danger">Acil</span>}
                      <span className="customer-request-date">{formatDate(req.created_at)}</span>
                    </div>
                    <h3>{req.title}</h3>
                    <p className="customer-request-location">
                      <span aria-hidden="true">⌖</span>
                      {formatCityDistrict(req.city, req.district)
                        ? `${formatCityDistrict(req.city, req.district)} · Yaklaşık konum`
                        : 'Konum belirtilmedi'}
                    </p>
                    <p className="customer-request-description">
                      {req.description}
                    </p>
                    <div className="customer-request-footer">
                      <span className="customer-request-bids">
                        <strong>{req.bids_count}</strong> teklif
                      </span>
                      <Link href={`/requests/${req.id}`} className="customer-request-open">
                        Teklifleri incele <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
