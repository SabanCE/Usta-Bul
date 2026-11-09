'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAuthHeaders } from '../../../utils/api';
import { formatCityDistrict, formatLocation } from '../../../utils/location';
import LocationMap from '../../../components/LocationMap';
import DrivingTimeBadge from '../../../components/DrivingTimeBadge';
import ReportButton from '../../../components/ReportButton';

interface Bid {
  id: string;
  artisan_id: string;
  artisan_name: string;
  artisan_rating: number | null;
  artisan_avatar: string | null;
  artisan_phone: string | null;
  artisan_latitude?: number | null;
  artisan_longitude?: number | null;
  price: number;
  estimated_duration: string;
  note: string;
  status: 'pending' | 'accepted' | 'rejected';
  is_accepted: boolean;
  created_at: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface RequestDetail {
  id: string;
  category: string;
  title: string;
  description: string;
  address: string;
  city: string | null;
  district: string | null;
  latitude?: number | null;
  longitude?: number | null;
  urgency: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  images: string[];
  bids: Bid[];
  review?: Review | null;
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

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedArtisan, setAcceptedArtisan] = useState<{ id: string; name: string; phone: string | null } | null>(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [existingReview, setExistingReview] = useState<Review | null>(null);

  const fetchDetail = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`http://localhost:5000/api/v1/requests/${params.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Talep detayı yüklenemedi.');
      }

      const request = data.data as RequestDetail;
      setDetail(request);
      setExistingReview(request.review ?? null);
      const accepted = request.bids?.find((b) => b.is_accepted);
      if (accepted) {
        setAcceptedArtisan({ id: accepted.artisan_id, name: accepted.artisan_name, phone: accepted.artisan_phone });
      }
    } catch (err: any) {
      setDetail(null);
      setExistingReview(null);
      setErrorMsg(err?.message || 'Talep detayı yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  const handleAcceptBid = async (bidId: string) => {
    if (!detail) return;
    const confirmed = window.confirm('Bu ustanın teklifini kabul etmek istiyor musunuz? İş başlayacak ve ustanın iletişim numarası açılacaktır.');
    if (!confirmed) return;

    const selectedBid = detail.bids.find((b) => b.id === bidId);
    if (!selectedBid) return;

    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`http://localhost:5000/api/v1/requests/${params.id}/bids/${bidId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error?.message || 'Teklif kabul edilemedi.');
      }

      const assigned = json?.assignedArtisan;
      setAcceptedArtisan({
        id: selectedBid.artisan_id,
        name: assigned?.full_name || selectedBid.artisan_name,
        phone: assigned?.phone ?? selectedBid.artisan_phone,
      });

      setDetail({
        ...detail,
        status: 'in_progress',
        bids: detail.bids.map((b) => ({
          ...b,
          status: b.id === bidId ? 'accepted' : 'rejected',
          is_accepted: b.id === bidId,
        })),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Teklif kabul edilemedi. Lütfen tekrar deneyin.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBid = async (bidId: string) => {
    if (!detail) return;

    const selectedBid = detail.bids.find((b) => b.id === bidId);
    if (!selectedBid) return;

    const confirmed = window.confirm(
      `${selectedBid.artisan_name} adlı ustanın teklifini reddetmek istiyor musunuz? Bu işlem geri alınamaz.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(
        `http://localhost:5000/api/v1/requests/${params.id}/bids/${bidId}/reject`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error?.message || 'Teklif reddedilemedi.');
      }

      setDetail({
        ...detail,
        bids: detail.bids.map((b) =>
          b.id === bidId ? { ...b, status: 'rejected', is_accepted: false } : b
        ),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Teklif reddedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!detail) return;
    const confirmed = window.confirm('İşin başarıyla tamamlandığını onaylıyor musunuz?');
    if (!confirmed) return;

    setActionLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`http://localhost:5000/api/v1/requests/${params.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'completed' }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error?.message || 'İş durumu güncellenemedi.');
      }

      setDetail({ ...detail, status: 'completed' });

      if (!existingReview) {
        setReviewRating(5);
        setReviewComment('');
        setReviewError('');
        setReviewSuccess(false);
        setShowReviewModal(true);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'İş durumu güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const artisanId = acceptedArtisan?.id || detail?.bids?.find((b) => b.is_accepted)?.artisan_id;

    if (!artisanId) {
      setReviewError('Değerlendirilecek usta bulunamadı.');
      return;
    }

    setSubmittingReview(true);
    setReviewError('');

    try {
      const res = await fetch(`http://localhost:5000/api/v1/artisans/${artisanId}/reviews`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment,
          requestId: params.id,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error?.message || 'Değerlendirme kaydedilemedi.');
      }

      const savedReview = (json?.data as Review | undefined) ?? {
        id: 'local',
        rating: reviewRating,
        comment: reviewComment || null,
        created_at: new Date().toISOString(),
      };

      setExistingReview(savedReview);
      setDetail((prev) => (prev ? { ...prev, review: savedReview } : prev));
      setReviewSuccess(true);
      setTimeout(() => {
        setShowReviewModal(false);
      }, 1500);
    } catch (err: any) {
      setReviewError(err?.message || 'Değerlendirme kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return <div className="loading-text">Talep detayları yükleniyor...</div>;
  }

  if (!detail) {
    return (
      <div className="empty-state" style={{ margin: '4rem auto', maxWidth: 480 }}>
        <h2 className="empty-title">Talep yüklenemedi</h2>
        {errorMsg && <p style={{ marginTop: '0.5rem' }}>{errorMsg}</p>}
        <Link href="/requests" className="btn btn-primary mt-2">
          Taleplerime dön
        </Link>
      </div>
    );
  }

  const statusMap: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Teklif bekliyor', cls: 'badge-warning' },
    in_progress: { label: 'Devam ediyor', cls: 'badge-accent' },
    completed: { label: 'Tamamlandı', cls: 'badge-success' },
    cancelled: { label: 'İptal edildi', cls: 'badge-danger' },
  };
  const st = statusMap[detail.status] || statusMap.pending;
  const urgencyLabel = detail.urgency === 'urgent' ? 'Acil' : detail.urgency === 'flexible' ? 'Esnek' : 'Normal';
  const requestPoint =
    typeof detail.latitude === 'number' && typeof detail.longitude === 'number'
      ? { latitude: detail.latitude, longitude: detail.longitude }
      : null;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 880 }}>
        <div className="mb-3">
          <Link href="/requests" className="small muted">
            ← Taleplerime dön
          </Link>
          <div className="flex-between mt-1">
            <h1 className="page-title">{detail.title}</h1>
            <span className={`badge ${st.cls}`}>{st.label}</span>
          </div>
        </div>

        {errorMsg && <div className="alert alert-error mb-3">{errorMsg}</div>}

        {acceptedArtisan && (
          <div className="card mb-3" style={{ borderColor: '#a7f3d0', background: 'var(--success-soft)' }}>
            <div className="card-body flex-between">
              <div>
                <span className="badge badge-success mb-1">Anlaşılan usta</span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{acceptedArtisan.name}</h3>
                <div className="small muted mt-1">
                  İletişim:{' '}
                  {acceptedArtisan.phone ? (
                    <a href={`tel:${acceptedArtisan.phone}`} style={{ color: 'var(--success)', fontWeight: 600 }}>
                      {acceptedArtisan.phone}
                    </a>
                  ) : (
                    <span>Telefon bilgisi yok</span>
                  )}
                </div>
              </div>

              <div>
                {detail.status === 'in_progress' && (
                  <button type="button" onClick={handleCompleteJob} disabled={actionLoading} className="btn btn-success">
                    İşi tamamlandı olarak onayla
                  </button>
                )}
                {detail.status === 'completed' &&
                  (existingReview ? (
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-success">Değerlendirildi</span>
                      <div className="small muted mt-1">
                        Verdiğiniz puan: {existingReview.rating}/5
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewRating(5);
                        setReviewComment('');
                        setReviewError('');
                        setReviewSuccess(false);
                        setShowReviewModal(true);
                      }}
                      className="btn btn-primary"
                    >
                      Ustayı değerlendir
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        <div className="card mb-3">
          <div className="card-body">
            <p style={{ color: 'var(--ink-soft)', fontSize: '0.95rem', lineHeight: 1.65 }}>{detail.description}</p>

            <div className="flex flex-wrap muted small mt-2" style={{ gap: '1.25rem' }}>
              <span>{formatLocation(detail.city, detail.district, detail.address) || 'Konum belirtilmedi'}</span>
              <span>Aciliyet: <strong style={{ color: 'var(--ink)' }}>{urgencyLabel}</strong></span>
              <span>{formatDate(detail.created_at)}</span>
            </div>

            {detail.images && detail.images.length > 0 && (
              <div className="flex mt-2" style={{ overflowX: 'auto' }}>
                {detail.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt="Talep fotoğrafı"
                    style={{ width: 120, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                ))}
              </div>
            )}

            {typeof detail.latitude === 'number' && typeof detail.longitude === 'number' && (
              <LocationMap
                className="mt-2"
                latitude={detail.latitude}
                longitude={detail.longitude}
                locationLabel={formatCityDistrict(detail.city, detail.district)}
                title="Hizmet konumu haritası"
                height={240}
              />
            )}
            <div className="mt-1">
              <ReportButton targetType="request" targetId={detail.id} />
            </div>
          </div>
        </div>

        <div className="flex-between mb-2">
          <h2 className="section-title">Gelen teklifler ({detail.bids?.length || 0})</h2>
          <button type="button" onClick={fetchDetail} className="btn btn-secondary btn-sm">
            Yenile
          </button>
        </div>

        {!detail.bids || detail.bids.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-title">Henüz teklif gelmedi</h3>
            <p>Bölgenizdeki ustalara bildirim gönderildi. Teklifler geldiğinde burada listelenecektir.</p>
          </div>
        ) : (
          <div className="list">
            {detail.bids.map((bid) => {
              const isAccepted = bid.is_accepted;
              const isRejected = bid.status === 'rejected';
              const artisanPoint =
                typeof bid.artisan_latitude === 'number' &&
                typeof bid.artisan_longitude === 'number'
                  ? {
                      latitude: bid.artisan_latitude,
                      longitude: bid.artisan_longitude,
                    }
                  : null;

              return (
                <div
                  key={bid.id}
                  className="card"
                  style={{
                    borderColor: isAccepted ? '#a7f3d0' : 'var(--border)',
                    opacity: isRejected ? 0.72 : 1,
                  }}
                >
                  <div className="card-body">
                    <div className="flex-between">
                      <div className="flex" style={{ gap: '0.8rem' }}>
                        {bid.artisan_avatar ? (
                          <img
                            src={bid.artisan_avatar}
                            alt={bid.artisan_name}
                            className="avatar"
                          />
                        ) : (
                          <div className="avatar avatar-initial" aria-hidden="true">
                            {bid.artisan_name?.charAt(0) || 'U'}
                          </div>
                        )}
                        <div>
                          <div className="artisan-name">{bid.artisan_name}</div>
                          <div className="artisan-meta">
                            {bid.artisan_rating ?? 0} puan · {bid.estimated_duration}
                          </div>
                          {artisanPoint && requestPoint && (
                            <div className="mt-1">
                              <DrivingTimeBadge
                                origin={artisanPoint}
                                destination={requestPoint}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="price">{bid.price} ₺</div>
                    </div>

                    {bid.note && (
                      <div className="alert alert-warning mt-2" style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink-soft)' }}>
                        <strong>Usta notu:</strong> {bid.note}
                      </div>
                    )}
                    <div className="mt-1">
                      <ReportButton targetType="bid" targetId={bid.id} />
                    </div>

                    <div className="flex-between mt-2" style={{ alignItems: 'center', gap: '0.75rem' }}>
                      <span className="small muted" />
                      <div
                        className="flex"
                        style={{
                          gap: '0.5rem',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {isAccepted ? (
                          <span className="badge badge-success">Kabul edildi</span>
                        ) : isRejected ? (
                          <span className="badge badge-danger">Reddedildi</span>
                        ) : detail.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRejectBid(bid.id)}
                              disabled={actionLoading}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)' }}
                            >
                              Teklifi reddet
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAcceptBid(bid.id)}
                              disabled={actionLoading}
                              className="btn btn-primary btn-sm"
                            >
                              Teklifi kabul et
                            </button>
                          </>
                        ) : (
                          <span className="small muted">İş başka bir usta ile başlatıldı</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showReviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div className="auth-card" style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 750, marginBottom: '0.35rem' }}>
              Ustayı değerlendir
            </h3>
            <p className="small muted mb-3">
              <strong>{acceptedArtisan?.name || 'Usta'}</strong> için puan ve yorumunuzu paylaşın.
            </p>

            {reviewSuccess ? (
              <div className="alert alert-success">Değerlendirmeniz kaydedildi. Teşekkür ederiz.</div>
            ) : (
              <form onSubmit={handleSubmitReview}>
                {reviewError && <div className="alert alert-error mb-2">{reviewError}</div>}
                <div className="text-center mb-3">
                  <label className="label" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    Hizmetten ne kadar memnun kaldınız?
                  </label>
                  <div className="flex" style={{ justifyContent: 'center', gap: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        style={{
                          fontSize: '1.75rem',
                          background: 'transparent',
                          border: 'none',
                          color: star <= reviewRating ? '#f59e0b' : '#d1d5db',
                          padding: '0 0.15rem',
                        }}
                        aria-label={`${star} yıldız`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span className="small muted">{reviewRating} / 5</span>
                </div>

                <div className="field mb-3">
                  <label className="label">Yorumunuz</label>
                  <textarea
                    rows={3}
                    required
                    className="textarea"
                    placeholder="Ustanın zamanında gelişi ve işçiliği nasıldı?"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                </div>

                <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowReviewModal(false)} className="btn btn-ghost">
                    Daha sonra
                  </button>
                  <button type="submit" disabled={submittingReview} className="btn btn-primary">
                    {submittingReview ? 'Kaydediliyor...' : 'Gönder'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
