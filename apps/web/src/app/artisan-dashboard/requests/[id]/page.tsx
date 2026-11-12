'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RouteMapDemo from '../../../../components/RouteMapDemo';
import { apiUrl, getAuthHeaders } from '../../../../utils/api';
import { formatLocation, haversineDistanceKm, formatDistanceKm } from '../../../../utils/location';

interface Opportunity {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  category: string;
  title: string;
  description: string;
  address: string;
  city: string | null;
  district: string | null;
  latitude?: number | null;
  longitude?: number | null;
  urgency: string;
  created_at: string;
  images: string[];
}

interface ArtisanBid {
  request_id: string;
  price: number;
  estimated_duration: string | null;
  note: string | null;
  status: string;
  is_accepted: boolean;
}

interface ArtisanCenter {
  latitude: number;
  longitude: number;
}

interface DashboardResponse {
  profile: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  opportunities: Opportunity[];
  bids: ArtisanBid[];
}

const categoryLabels: Record<string, string> = {
  plumber: 'Sıhhi Tesisat',
  electrician: 'Elektrik',
  painter: 'Boya & Badana',
  carpenter: 'Marangoz',
  locksmith: 'Çilingir',
  appliance: 'Beyaz Eşya',
  renovation: 'Tadilat',
};

function formatDate(value: string): string {
  if (!value) return '';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ArtisanRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;
  const [request, setRequest] = useState<Opportunity | null>(null);
  const [existingBid, setExistingBid] = useState<ArtisanBid | null>(null);
  const [artisanCenter, setArtisanCenter] = useState<ArtisanCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRequest = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(apiUrl('/api/v1/requests/artisan/dashboard'), {
          cache: 'no-store',
          headers: getAuthHeaders(),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error?.message || 'İş ayrıntıları yüklenemedi.');
        }

        const data = body?.data as DashboardResponse | undefined;
        const foundRequest = data?.opportunities?.find((item) => item.id === requestId) || null;
        if (!foundRequest) {
          throw new Error('Bu iş fırsatı bulunamadı veya artık başvuruya açık değil.');
        }

        if (!cancelled) {
          const profile = data?.profile;
          setRequest(foundRequest);
          setExistingBid(data?.bids?.find((bid) => bid.request_id === requestId) || null);
          setArtisanCenter(
            typeof profile?.latitude === 'number' && typeof profile?.longitude === 'number'
              ? { latitude: profile.latitude, longitude: profile.longitude }
              : null
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'İş ayrıntıları yüklenemedi.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRequest();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const requestPoint =
    request &&
    typeof request.latitude === 'number' &&
    typeof request.longitude === 'number'
      ? { latitude: request.latitude, longitude: request.longitude }
      : null;
  const distance =
    artisanCenter && requestPoint
      ? haversineDistanceKm(artisanCenter, requestPoint)
      : null;
  const canBid = !existingBid || existingBid.status === 'rejected';

  const handleSubmitBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Geçerli bir teklif tutarı girin.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiUrl(`/api/v1/requests/${requestId}/bids`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          price: numericPrice,
          estimatedDuration: duration || undefined,
          note: note || undefined,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || 'Teklif gönderilemedi.');
      }

      setExistingBid({
        request_id: requestId,
        price: numericPrice,
        estimated_duration: duration || null,
        note: note || null,
        status: 'pending',
        is_accepted: false,
      });
      setSuccess('Teklifiniz müşteriye iletildi.');
      setPrice('');
      setDuration('');
      setNote('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Teklif gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <Link href="/artisan-dashboard" className="btn btn-ghost btn-sm mb-3">
          ← İş fırsatlarına dön
        </Link>

        {loading ? (
          <div className="loading-text">İş ayrıntıları yükleniyor...</div>
        ) : error && !request ? (
          <div className="empty-state" role="alert">
            <h1 className="empty-title">İş görüntülenemedi</h1>
            <p>{error}</p>
            <Link href="/artisan-dashboard" className="btn btn-primary mt-2">
              İş fırsatlarına dön
            </Link>
          </div>
        ) : request ? (
          <div className="artisan-request-detail">
            <div className="artisan-request-detail-main">
              <div className="flex flex-wrap" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span className={`badge ${request.urgency === 'urgent' ? 'badge-danger' : 'badge-neutral'}`}>
                  {request.urgency === 'urgent' ? 'Acil iş' : categoryLabels[request.category] || request.category}
                </span>
                <span className="small muted">{formatDate(request.created_at)}</span>
                {distance !== null && (
                  <span className="badge badge-neutral">~{formatDistanceKm(distance)} uzakta</span>
                )}
              </div>

              <h1 className="page-title">{request.title}</h1>
              <div className="artisan-request-detail-meta">
                <div>
                  <span className="small muted">Müşteri</span>
                  <strong>{request.customer_name || 'Müşteri'}</strong>
                </div>
                <div>
                  <span className="small muted">Hizmet adresi</span>
                  <strong>{formatLocation(request.city, request.district, request.address) || 'Belirtilmedi'}</strong>
                </div>
                {request.customer_phone && (
                  <div>
                    <span className="small muted">Telefon</span>
                    <a href={`tel:${request.customer_phone}`}>{request.customer_phone}</a>
                  </div>
                )}
              </div>

              <section className="artisan-request-detail-section">
                <h2 className="section-title">İş açıklaması</h2>
                <p className="artisan-request-description">{request.description || 'Açıklama eklenmemiş.'}</p>
              </section>

              {request.images?.length > 0 && (
                <section className="artisan-request-detail-section">
                  <h2 className="section-title">İş fotoğrafları</h2>
                  <div className="artisan-request-images">
                    {request.images.map((image, index) => (
                      <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer">
                        <img src={image} alt={`${request.title} - fotoğraf ${index + 1}`} />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {artisanCenter && requestPoint && (
                <section className="artisan-request-detail-section">
                  <h2 className="section-title">İş konumu ve rota</h2>
                  <RouteMapDemo
                    origin={artisanCenter}
                    destination={requestPoint}
                    originLabel="Hizmet konumunuz"
                    destinationLabel="İş konumu"
                  />
                </section>
              )}
            </div>

            <aside className="card artisan-request-bid-card">
              <div className="card-body">
                <h2 className="section-title">Teklifiniz</h2>
                {existingBid && (
                  <div className={`alert ${existingBid.status === 'rejected' ? 'alert-warning'                   : existingBid.is_accepted ? 'alert-success' : 'alert-warning'}`}>
                    {existingBid.status === 'rejected'
                      ? `Önceki ${existingBid.price} ₺ teklifiniz reddedildi. Yeni bir teklif gönderebilirsiniz.`
                      : existingBid.is_accepted
                        ? `Teklifiniz kabul edildi: ${existingBid.price} ₺`
                        : `Teklifiniz iletildi: ${existingBid.price} ₺`}
                  </div>
                )}

                {canBid ? (
                  <form onSubmit={handleSubmitBid}>
                    <label className="field">
                      <span className="label">Teklif tutarı (₺)</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="0.01"
                        required
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        className="input"
                        placeholder="Örn. 850"
                      />
                    </label>
                    <label className="field">
                      <span className="label">Tahmini süre</span>
                      <input
                        type="text"
                        maxLength={100}
                        value={duration}
                        onChange={(event) => setDuration(event.target.value)}
                        className="input"
                        placeholder="Örn. 2 saat"
                      />
                    </label>
                    <label className="field">
                      <span className="label">Müşteriye not</span>
                      <textarea
                        maxLength={1000}
                        rows={4}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className="textarea"
                        placeholder="İş için kısa bir açıklama ekleyin"
                      />
                    </label>
                    {error && <div className="alert alert-error" role="alert">{error}</div>}
                    {success && <div className="alert alert-success" role="status">{success}</div>}
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Gönderiliyor...' : existingBid ? 'Yeniden teklif ver' : 'Teklif gönder'}
                    </button>
                  </form>
                ) : (
                  <p className="muted">Bu iş için teklifiniz gönderildi. Durumunu “Tekliflerim” bölümünden takip edebilirsiniz.</p>
                )}
                {!canBid && error && <div className="alert alert-error mt-2" role="alert">{error}</div>}
                <Link href="/artisan-dashboard" className="btn btn-secondary mt-2">
                  İş fırsatlarına dön
                </Link>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
