'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAuthHeaders } from '../../utils/api';
import { formatLocation } from '../../utils/location';

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
        const res = await fetch('http://localhost:5000/api/v1/requests', {
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

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Müşteri paneli</p>
            <h1 className="page-title">Taleplerim ve teklifler</h1>
            <p className="page-subtitle">
              Açtığınız hizmet taleplerini takip edin, ustalardan gelen teklifleri değerlendirin.
            </p>
          </div>
          <Link href="/requests/new" className="btn btn-primary">
            Yeni talep aç
          </Link>
        </div>

        <div className="tabs mb-3">
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

        {errorMsg && <div className="alert alert-error mb-3">{errorMsg}</div>}

        {loading ? (
          <div className="loading-text">Talepler yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-title">Bu durumda bir talebiniz yok</h3>
            <p style={{ marginBottom: '1.25rem' }}>Evinizdeki arıza veya montaj işleri için ücretsiz talep oluşturabilirsiniz.</p>
            <Link href="/requests/new" className="btn btn-primary">
              Talep oluştur
            </Link>
          </div>
        ) : (
          <div className="list">
            {filtered.map((req) => {
              const st = statusMap[req.status] || statusMap.pending;
              return (
                <div key={req.id} className="list-item">
                  {req.images && req.images.length > 0 && (
                    <img src={req.images[0]} alt={req.title} className="list-thumb" />
                  )}

                  <div className="list-main">
                    <div className="flex" style={{ marginBottom: '0.35rem' }}>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      {req.urgency === 'urgent' && <span className="badge badge-danger">Acil</span>}
                      <span className="small muted">{formatDate(req.created_at)}</span>
                    </div>
                    <h3 className="list-title">{req.title}</h3>
                    <p className="list-sub">
                      {formatLocation(req.city, req.district, req.address) || 'Konum belirtilmedi'}
                    </p>
                    <p className="small muted" style={{ marginTop: '0.25rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {req.description}
                    </p>
                  </div>

                  <div className="list-side">
                    <div className="big-number">{req.bids_count}</div>
                    <div className="big-number-label">usta teklifi</div>
                    <Link href={`/requests/${req.id}`} className="btn btn-secondary btn-sm mt-2">
                      Teklifleri gör
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
