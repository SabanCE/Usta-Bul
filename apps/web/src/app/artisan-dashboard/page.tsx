'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import {
  formatDistanceKm,
  formatLocation,
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  haversineDistanceKm,
} from '../../utils/location';
import { apiUrl, getAuthHeaders } from '../../utils/api';
import RouteMapDemo from '../../components/RouteMapDemo';
import DiscoveryMap, { DiscoveryPoint } from '../../components/DiscoveryMap';
import DraggableMapPanel from '../../components/DraggableMapPanel';

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
  id: string;
  request_id: string;
  price: number;
  estimated_duration: string | null;
  note: string | null;
  status: string;
  is_accepted: boolean;
  created_at: string;
  request_title: string;
  request_category: string;
  request_description?: string | null;
  request_address?: string | null;
  request_city: string | null;
  request_district: string | null;
  request_latitude?: number | null;
  request_longitude?: number | null;
  request_status: string;
  request_urgency: string;
  request_created_at?: string | null;
  request_images?: string[] | null;
  customer_name: string;
  customer_phone?: string | null;
}

function formatDate(value: string): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

export default function ArtisanDashboardPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'opportunities' | 'my_bids' | 'completed'>('opportunities');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [myBids, setMyBids] = useState<ArtisanBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [artisanProfile, setArtisanProfile] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedBid, setSelectedBid] = useState<ArtisanBid | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedMapOpportunityId, setSelectedMapOpportunityId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const [withdrawingBidId, setWithdrawingBidId] = useState<string | null>(null);
  const [completingJob, setCompletingJob] = useState(false);

  // Hızlı Müsaitlik Değiştirme
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);

  // Teklif verme state'i
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch(apiUrl('/api/v1/requests/artisan/dashboard'), {
        cache: 'no-store',
        headers: getAuthHeaders(),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body?.error?.message || 'Usta paneli verileri sunucudan alınamadı. Lütfen tekrar deneyin.'
        );
      }

      setArtisanProfile(body?.data?.profile ?? null);
      setOpportunities(Array.isArray(body?.data?.opportunities) ? body.data.opportunities : []);
      setMyBids(Array.isArray(body?.data?.bids) ? body.data.bids : []);
      setErrorMsg(body?.data?.errors?.profile || body?.data?.errors?.bids || '');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Usta paneli verileri yüklenemedi.');
      setOpportunities([]);
      setMyBids([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Teklifi Backend'e Gönder
  const handleSendBid = async (requestId: string) => {
    setBidError('');
    setSuccessMsg('');

    const numericPrice = Number(price);
    if (!price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      setBidError('Geçerli bir teklif tutarı girin.');
      return;
    }

    setSubmittingBid(true);

    try {
      const res = await fetch(apiUrl(`/api/v1/requests/${requestId}/bids`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          price: numericPrice,
          estimatedDuration: duration || undefined,
          note: note || undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Teklif gönderilemedi.');
      }

      setActiveRequestId(null);
      setPrice('');
      setDuration('');
      setNote('');
      setSelectedOpportunity(null);
      setSuccessMsg('Teklifiniz müşteriye iletildi. "Tekliflerim" sekmesinden takip edebilirsiniz.');
      fetchData(); // Listeyi yenile
    } catch (err: any) {
      setBidError(err?.message || 'Teklif gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmittingBid(false);
    }
  };

  // Müsaitlik Durumunu Hızlı Aç/Kapat
  const toggleAvailability = async () => {
    setIsUpdatingAvailability(true);
    setErrorMsg('');
    const newStatus = !(artisanProfile?.is_available ?? true);

    try {
      const res = await fetch(apiUrl('/api/v1/artisans/profile/me'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isAvailable: newStatus }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Müsaitlik durumu güncellenemedi.');
      }

      const saved = json?.data;
      setArtisanProfile((prev: any) => ({
        ...(prev || {}),
        ...(saved || {}),
        is_available: saved?.is_available ?? newStatus,
      }));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Müsaitlik durumu güncellenemedi. Lütfen bağlantınızı kontrol edin.');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const currentCategory = artisanProfile?.category || '';
  const currentArea = formatLocation(artisanProfile?.city, artisanProfile?.district);
  const currentRadius = artisanProfile?.service_radius_km;
  const isAvailable = artisanProfile?.is_available ?? true;
  const artisanCenter = useMemo(
    () =>
      typeof artisanProfile?.latitude === 'number' &&
      typeof artisanProfile?.longitude === 'number'
        ? {
            latitude: artisanProfile.latitude as number,
            longitude: artisanProfile.longitude as number,
          }
        : null,
    [artisanProfile?.latitude, artisanProfile?.longitude]
  );

  const isCompletedJob = (bid: ArtisanBid) =>
    bid.request_status === 'completed' && bid.is_accepted;

  const completedBids = myBids.filter(isCompletedJob);
  const activeBids = myBids.filter((bid) => !isCompletedJob(bid));
  const acceptedJobCount = myBids.filter(
    (bid) => bid.is_accepted && bid.request_status === 'in_progress'
  ).length;
  const activeOfferCount = myBids.filter(
    (bid) => bid.status === 'pending' && bid.request_status === 'pending'
  ).length;

  const requestStatusMap: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Teklif bekliyor', cls: 'badge-warning' },
    in_progress: { label: 'Devam ediyor', cls: 'badge-accent' },
    completed: { label: 'Tamamlandı', cls: 'badge-success' },
    cancelled: { label: 'İptal edildi', cls: 'badge-danger' },
  };

  const getBidStatus = (bid: ArtisanBid): { label: string; cls: string } => {
    if (bid.is_accepted) {
      if (bid.request_status === 'completed') {
        return { label: 'Tamamlandı', cls: 'badge-success' };
      }
      if (bid.request_status === 'cancelled') {
        return { label: 'İş iptal edildi', cls: 'badge-danger' };
      }
      return { label: 'Teklifiniz kabul edildi', cls: 'badge-success' };
    }
    if (bid.status === 'rejected' || bid.request_status === 'completed') {
      return { label: 'Teklif kabul edilmedi', cls: 'badge-danger' };
    }
    if (bid.request_status === 'cancelled') {
      return { label: 'Talep iptal edildi', cls: 'badge-danger' };
    }
    return { label: 'Müşteriden cevap bekleniyor', cls: 'badge-warning' };
  };

  const openBidDetail = (bid: ArtisanBid) => {
    setSelectedBid(bid);
  };

  // "Tekliflerim" listesindeki reddedilmiş tekliften hızlıca yeniden teklif verme.
  const startRebidFromBid = (bid: ArtisanBid) => {
    const opportunity: Opportunity = {
      id: bid.request_id,
      customer_name: bid.customer_name,
      category: bid.request_category,
      title: bid.request_title,
      description: bid.request_description || '',
      address: bid.request_address || '',
      city: bid.request_city,
      district: bid.request_district,
      latitude: bid.request_latitude ?? null,
      longitude: bid.request_longitude ?? null,
      urgency: bid.request_urgency,
      created_at: bid.request_created_at || bid.created_at,
      images: bid.request_images || [],
    };
    openOpportunity(opportunity, true);
  };

  const openOpportunity = (item: Opportunity, startBidding = false) => {
    setSelectedOpportunity(item);
    setBidError('');

    if (startBidding) {
      const existingBid = myBids.find((bid) => bid.request_id === item.id);
      const alreadyBid = existingBid && existingBid.status !== 'rejected';

      if (!alreadyBid) {
        // Reddedilmiş teklif varsa önceki tutar/süre/not ile ön doldur.
        setPrice(existingBid ? String(existingBid.price) : '');
        setDuration(existingBid?.estimated_duration || '');
        setNote(existingBid?.note || '');
        setActiveRequestId(item.id);
      }
    } else {
      setActiveRequestId(null);
    }
  };

  const closeOpportunity = () => {
    setSelectedOpportunity(null);
    setActiveRequestId(null);
    setBidError('');
  };

  const handleWithdrawBid = async (bid: ArtisanBid) => {
    if (withdrawingBidId) return;

    const confirmed = window.confirm(
      'Bu teklifi geri çekmek istediğinize emin misiniz? Teklifiniz müşterinin listesinden kaldırılacak ve dilediğiniz zaman yeniden teklif verebilirsiniz.'
    );
    if (!confirmed) return;

    setWithdrawingBidId(bid.id);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(
        apiUrl(`/api/v1/requests/${bid.request_id}/bids/${bid.id}`),
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error?.message || 'Teklif geri çekilemedi.');
      }

      setMyBids((previous) => previous.filter((item) => item.id !== bid.id));
      setSelectedBid((previous) => (previous && previous.id === bid.id ? null : previous));
      setSuccessMsg(
        'Teklifiniz geri çekildi. "İş fırsatları" sekmesinden yeniden teklif verebilirsiniz.'
      );
      fetchData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Teklif geri çekilemedi. Lütfen tekrar deneyin.');
    } finally {
      setWithdrawingBidId(null);
    }
  };

  const handleCompleteJob = async (bid: ArtisanBid) => {
    if (completingJob) return;

    const confirmed = window.confirm(
      'Bu işi tamamlandı olarak işaretlemek istiyor musunuz? İş, müşteri tarafında da tamamlandı olarak görünecek.'
    );
    if (!confirmed) return;

    setCompletingJob(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(
        apiUrl(`/api/v1/requests/${bid.request_id}/status`),
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: 'completed' }),
        }
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error?.message || 'İş durumu güncellenemedi.');
      }

      setMyBids((previous) =>
        previous.map((item) =>
          item.request_id === bid.request_id
            ? { ...item, request_status: 'completed' }
            : item
        )
      );
      setSelectedBid(null);
      setActiveTab('completed');
      setSuccessMsg(
        'İş tamamlandı olarak işaretlendi. "Tamamladıklarım" sekmesine taşındı.'
      );
      fetchData();
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'İş durumu güncellenemedi. Lütfen tekrar deneyin.'
      );
    } finally {
      setCompletingJob(false);
    }
  };

  const selectedRequestPoint =
    selectedBid &&
    typeof selectedBid.request_latitude === 'number' &&
    typeof selectedBid.request_longitude === 'number'
      ? {
          latitude: selectedBid.request_latitude,
          longitude: selectedBid.request_longitude,
        }
      : null;

  const selectedOpportunityPoint =
    selectedOpportunity &&
    typeof selectedOpportunity.latitude === 'number' &&
    typeof selectedOpportunity.longitude === 'number'
      ? {
          latitude: selectedOpportunity.latitude,
          longitude: selectedOpportunity.longitude,
        }
      : null;

  const selectedOpportunityDistance =
    artisanCenter && selectedOpportunityPoint
      ? haversineDistanceKm(artisanCenter, selectedOpportunityPoint)
      : null;

  const selectedOpportunityBid = selectedOpportunity
    ? myBids.find((bid) => bid.request_id === selectedOpportunity.id)
    : null;

  const mapOpportunityPoints = useMemo<DiscoveryPoint[]>(() => opportunities.flatMap((opportunity) => {
    if (
      typeof opportunity.latitude !== 'number' ||
      !Number.isFinite(opportunity.latitude) ||
      typeof opportunity.longitude !== 'number' ||
      !Number.isFinite(opportunity.longitude)
    ) return [];
    return [{
      id: opportunity.id,
      latitude: opportunity.latitude,
      longitude: opportunity.longitude,
      kind: 'request',
      title: opportunity.title,
      subtitle: categoryLabels[opportunity.category] || opportunity.category,
      selected: selectedMapOpportunityId === opportunity.id,
    }];
  }), [opportunities, selectedMapOpportunityId]);
  const selectedMapOpportunity = opportunities.find((item) => item.id === selectedMapOpportunityId) || null;
  const selectedMapBid = selectedMapOpportunity
    ? myBids.find((bid) => bid.request_id === selectedMapOpportunity.id)
    : null;
  const selectedMapCanBid = !selectedMapBid || selectedMapBid.status === 'rejected';

  const focusMapOpportunity = (opportunityId: string) => {
    setSelectedMapOpportunityId(opportunityId);
    setMapFocusRequest((request) => request + 1);
  };

  useEffect(() => {
    if (selectedMapOpportunityId) {
      const list = document.querySelector('.rota-artisan-panel .rota-list');
      const card = document.getElementById(`rota-job-${selectedMapOpportunityId}`);
      if (!(list instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
      const listBounds = list.getBoundingClientRect();
      const cardBounds = card.getBoundingClientRect();
      if (cardBounds.top < listBounds.top) {
        list.scrollBy({ top: cardBounds.top - listBounds.top, behavior: 'smooth' });
      } else if (cardBounds.bottom > listBounds.bottom) {
        list.scrollBy({ top: cardBounds.bottom - listBounds.bottom, behavior: 'smooth' });
      }
    }
  }, [selectedMapOpportunityId]);

  const canBidOnSelectedOpportunity =
    !selectedOpportunityBid || selectedOpportunityBid.status === 'rejected';

  const startMapBid = (opportunity: Opportunity) => {
    const existingBid = myBids.find((bid) => bid.request_id === opportunity.id);
    focusMapOpportunity(opportunity.id);
    setPrice(existingBid?.status === 'rejected' ? String(existingBid.price) : '');
    setDuration(existingBid?.status === 'rejected' ? existingBid.estimated_duration || '' : '');
    setNote(existingBid?.status === 'rejected' ? existingBid.note || '' : '');
    setBidError('');
    setActiveRequestId(opportunity.id);
  };

  if (activeTab === 'opportunities') {
    return (
      <div className="rota-discovery rota-artisan-discovery">
        <DiscoveryMap
          points={mapOpportunityPoints}
          center={artisanCenter}
          radiusKm={currentRadius}
          onSelect={focusMapOpportunity}
          focusRequest={mapFocusRequest}
        />
        <DraggableMapPanel className="rota-panel rota-artisan-panel" ariaLabel="İş fırsatları">
          <div className="rota-panel-head">
            <div className="rota-brandline"><span className="rota-brandmark">U</span><span>USTA BUL <i>·</i> İŞ ROTASI</span></div>
            <p className="eyebrow">USTA PANELİ · {isAvailable ? 'MÜSAİT' : 'MEŞGUL'}</p>
            <h1>İşiniz,<br /><em>yakınınızda.</em></h1>
            <p className="rota-intro">{currentArea || 'Hizmet bölgeniz'}{currentRadius ? ` · ${currentRadius} km çevre` : ''}. Size uygun işleri haritada keşfedin.</p>
            <div className="rota-work-stats">
              <span><strong>{opportunities.length}</strong> açık iş</span>
              <span><strong>{activeOfferCount}</strong> teklifiniz</span>
            </div>
            <div className="rota-panel-actions">
              <button type="button" className={`rota-location-button${isAvailable ? '' : ' rota-busy-button'}`} onClick={() => void toggleAvailability()} disabled={isUpdatingAvailability}>
                <span>●</span>{isUpdatingAvailability ? 'Güncelleniyor…' : isAvailable ? 'Müsait durumdasınız' : 'Müsaitliği aç'}
              </button>
              <button type="button" className="rota-search-button" onClick={() => void fetchData()} disabled={loading}>{loading ? 'Yükleniyor…' : 'İşleri yenile'} <span>↻</span></button>
            </div>
          </div>

          {(errorMsg || successMsg) && <div className={`rota-panel-message${errorMsg ? ' rota-panel-message-error' : ''}`} role={errorMsg ? 'alert' : 'status'}>{errorMsg || successMsg}</div>}

          <div className="rota-results-head">
            <div><strong>{loading ? '…' : opportunities.length}</strong><span> uygun iş</span></div>
            <Link href="/artisan-dashboard/profile" className="rota-sort">Hizmet alanım ↗</Link>
          </div>
          <div className="rota-list" aria-label="Yakınınızdaki iş fırsatları">
            {loading ? <div className="rota-empty">Yakınınızdaki işler yükleniyor…</div> : opportunities.length === 0 ? (
              <div className="rota-empty">
                <span className="rota-empty-icon">⌖</span>
                <strong>{!artisanProfile ? 'Usta profiliniz yüklenemedi' : artisanProfile.is_approved === false ? 'Profiliniz onay bekliyor' : !artisanCenter ? 'Hizmet konumunuz eksik' : 'Yakınınızda eşleşen iş yok'}</strong>
                <span>{!artisanCenter ? 'Haritada uygun işleri görebilmek için profilinize hizmet konumu ekleyin.' : 'Uzmanlığınıza ve hizmet alanınıza uygun yeni işler burada görünecek.'}</span>
                {!artisanCenter && <Link href="/artisan-dashboard/profile" className="rota-profile-link">Hizmet konumunu ekle ↗</Link>}
              </div>
            ) : opportunities.map((opportunity) => {
              const bid = myBids.find((item) => item.request_id === opportunity.id);
              const distance = artisanCenter && typeof opportunity.latitude === 'number' && typeof opportunity.longitude === 'number'
                ? formatDistanceKm(haversineDistanceKm(artisanCenter, { latitude: opportunity.latitude, longitude: opportunity.longitude }))
                : null;
              return (
                <article
                  key={opportunity.id}
                  id={`rota-job-${opportunity.id}`}
                  className={`rota-artisan rota-job${selectedMapOpportunityId === opportunity.id ? ' rota-artisan-active' : ''}`}
                  tabIndex={0}
                  aria-label={`${opportunity.title}, ${categoryLabels[opportunity.category] || opportunity.category}`}
                  onClick={() => focusMapOpportunity(opportunity.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      focusMapOpportunity(opportunity.id);
                    }
                  }}
                >
                  <div className="rota-job-heading">
                    <span className={`rota-job-type${opportunity.urgency === 'urgent' ? ' rota-job-urgent' : ''}`}>{opportunity.urgency === 'urgent' ? 'ACİL İŞ' : categoryLabels[opportunity.category] || opportunity.category}</span>
                    <span className="small muted">{formatDate(opportunity.created_at) || 'Yeni'}</span>
                  </div>
                  <strong className="rota-job-title">{opportunity.title}</strong>
                  <span className="rota-job-location">{formatLocation(opportunity.city, opportunity.district) || 'Konum belirtilmedi'}{distance ? ` · ${distance}` : ''}</span>
                  {opportunity.customer_phone && (
                    <a
                      className="rota-customer-phone"
                      href={`tel:${opportunity.customer_phone}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      ☎ {opportunity.customer_phone}
                    </a>
                  )}
                  <div className="rota-job-footer">
                    {bid ? <span className={`rota-bid-state${bid.status === 'rejected' ? ' rota-bid-rejected' : ''}`}>{bid.status === 'rejected' ? 'Tekrar teklif verilebilir' : bid.is_accepted ? 'Teklif kabul edildi' : 'Teklif gönderildi'}</span> : <span className="small muted">Müşteri: {opportunity.customer_name || 'Müşteri'}</span>}
                    <span className="rota-pin-action">İncele ↗</span>
                  </div>
                  {selectedMapOpportunityId === opportunity.id && (
                    <div className="rota-job-detail">
                      {opportunity.description && <p>{opportunity.description}</p>}
                      {opportunity.address && <span className="rota-job-address">⌖ {formatLocation(opportunity.city, opportunity.district, opportunity.address)}</span>}
                      {opportunity.images?.length > 0 && <div className="rota-job-images">{opportunity.images.slice(0, 3).map((image) => <img key={image} src={image} alt="İş talebi" />)}</div>}
                      {activeRequestId === opportunity.id && selectedMapCanBid ? (
                        <form className="rota-bid-form" onSubmit={(event) => { event.preventDefault(); void handleSendBid(opportunity.id); }}>
                          <label>Teklif tutarı (₺)<input type="number" min={1} required value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Örn. 850" /></label>
                          <label>Tahmini süre<input type="text" maxLength={100} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Örn. 2 saat" /></label>
                          <label className="rota-bid-note">Müşteriye not<textarea maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="İş için kısa bir açıklama ekleyin" /></label>
                          {bidError && <p className="rota-inline-error" role="alert">{bidError}</p>}
                          <div className="rota-bid-actions">
                            <button type="button" className="rota-profile-link" onClick={() => { setActiveRequestId(null); setBidError(''); }}>Vazgeç</button>
                            <button type="submit" className="rota-request-link" disabled={submittingBid || !price}>{submittingBid ? 'Gönderiliyor…' : 'Teklifi gönder'} <span>↗</span></button>
                          </div>
                        </form>
                      ) : (
                        <div className="rota-job-actions">
                          {typeof opportunity.latitude === 'number' && typeof opportunity.longitude === 'number' && <a className="rota-profile-link" href={googleMapsDirectionsUrl({ latitude: opportunity.latitude, longitude: opportunity.longitude }, artisanCenter)} target="_blank" rel="noreferrer">Yol tarifi ↗</a>}
                          {selectedMapCanBid && <button type="button" className="rota-request-link" onClick={() => startMapBid(opportunity)}>{bid?.status === 'rejected' ? 'Yeniden teklif ver' : 'Teklif ver'} <span>↗</span></button>}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="rota-panel-foot"><span><i className="rota-legend-dot rota-legend-job" /> Uzmanlık ve hizmet alanınıza göre eşleşen işler</span><button type="button" onClick={() => setActiveTab('my_bids')}>Tekliflerim ({activeBids.length})</button></div>
        </DraggableMapPanel>
        <div className="rota-map-hint"><span className="rota-user-legend rota-user-legend-artisan" />{artisanCenter ? `Hizmet merkeziniz · ${currentRadius || 25} km` : 'İşaret seçerek işleri inceleyin'}</div>
        <div className="rota-floating-tabs">
          <button type="button" className="rota-tab-active" onClick={() => setActiveTab('opportunities')}>İş fırsatları <b>{opportunities.length}</b></button>
          <button type="button" onClick={() => setActiveTab('my_bids')}>Tekliflerim <b>{activeBids.length}</b></button>
          <button type="button" onClick={() => setActiveTab('completed')}>Tamamladıklarım <b>{completedBids.length}</b></button>
        </div>
      </div>
    );
  }

  const renderBidCard = (bid: ArtisanBid) => {
    const status = getBidStatus(bid);
    const isCompleted = isCompletedJob(bid);

    return (
      <div
        key={bid.id}
        className="card bid-card-clickable"
        role="button"
        tabIndex={0}
        onClick={() => openBidDetail(bid)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openBidDetail(bid);
          }
        }}
        style={{ borderColor: isCompleted ? '#a7f3d0' : 'var(--border)' }}
      >
        <div className="card-body">
          <div className="flex-between" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="flex flex-wrap" style={{ marginBottom: '0.5rem', gap: '0.5rem' }}>
                <span className={`badge ${status.cls}`}>{status.label}</span>
                <span className="small muted">
                  {new Date(bid.created_at).toLocaleDateString('tr-TR')}
                </span>
              </div>

              <h3 className="list-title">{bid.request_title}</h3>

              <p className="list-sub">
                Müşteri: <strong style={{ color: 'var(--ink)' }}>{bid.customer_name}</strong> · Konum:{' '}
                <strong style={{ color: 'var(--ink)' }}>
                  {formatLocation(bid.request_city, bid.request_district, bid.request_address) ||
                    'Belirtilmedi'}
                </strong>
              </p>

              {bid.is_accepted && bid.customer_phone && (
                <div className="alert alert-success" style={{ marginTop: '0.75rem' }}>
                  Müşteri iletişim numarası:{' '}
                  <a
                    href={`tel:${bid.customer_phone}`}
                    style={{ fontWeight: 700, color: 'var(--success)' }}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {bid.customer_phone}
                  </a>
                </div>
              )}

              <div
                className="alert"
                style={{
                  marginTop: '0.75rem',
                  background: 'var(--surface-muted)',
                  borderColor: 'var(--border)',
                  color: 'var(--ink-soft)',
                }}
              >
                <strong>Teklif notunuz:</strong> {bid.note || 'Özel not belirtilmedi.'}
              </div>

              <div className="bid-detail-hint" style={{ marginTop: '0.55rem' }}>
                Detayları ve yol haritasını gör →
              </div>
            </div>

            <div className="list-side">
              <div className="small muted">Verdiğiniz fiyat</div>
              <div className="price" style={{ fontSize: '1.5rem' }}>
                {bid.price} ₺
              </div>
              <div className="small muted">{bid.estimated_duration || 'Süre belirtilmedi'}</div>

              {!bid.is_accepted &&
                bid.status === 'pending' &&
                bid.request_status === 'pending' && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleWithdrawBid(bid);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    disabled={withdrawingBidId === bid.id}
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: '0.6rem', color: 'var(--danger)' }}
                  >
                    {withdrawingBidId === bid.id ? 'Geri çekiliyor...' : 'Teklifi çek'}
                  </button>
                )}

              {bid.status === 'rejected' && bid.request_status === 'pending' && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    startRebidFromBid(bid);
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '0.6rem' }}
                >
                  Tekrar teklif ver
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Usta paneli</p>
            <h1 className="page-title">Merhaba, {user?.fullName || 'Usta'}</h1>
            <p className="page-subtitle">
              {categoryLabels[currentCategory] || currentCategory || 'Kategori belirtilmedi'}
              {currentArea ? ` · ${currentArea}` : ''}
              {currentRadius ? ` · ${currentRadius} km hizmet yarıçapı` : ''}
            </p>
          </div>

          <div className="flex flex-wrap">
            <button
              type="button"
              onClick={toggleAvailability}
              disabled={isUpdatingAvailability}
              className="btn btn-secondary"
              title="Müsaitlik durumunu değiştir"
            >
              <span className="dot" style={{ color: isAvailable ? 'var(--success)' : 'var(--warning)' }} />
              {isUpdatingAvailability
                ? 'Güncelleniyor...'
                : isAvailable
                  ? 'Müsait · iş alıyor'
                  : 'Meşgul · duraklatıldı'}
            </button>
            <Link href="/artisan-dashboard/profile" className="btn btn-primary">
              Profilimi düzenle
            </Link>
            {user?.id && (
              <Link href={`/artisans/${user.id}`} className="btn btn-secondary">
                Portföyüm
              </Link>
            )}
          </div>
        </div>

        {errorMsg && <div className="alert alert-error mb-3">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success mb-3">{successMsg}</div>}

        {artisanProfile && artisanProfile.is_approved === false && (
          <div className="alert alert-warning mb-3">
            <strong>Profiliniz onay bekliyor.</strong> Yönetici onayı tamamlanana kadar
            ustalar listesinde ve arama sonuçlarında görünmezsiniz. Profil bilgilerinizi
            tamamlayıp kaydettiyseniz onay genellikle kısa süre içinde yapılır.
          </div>
        )}

        <div className="stat-grid">          <div className="stat-card">
            <div className="stat-label">Bölgenizdeki açık işler</div>
            <div className="stat-value">{opportunities.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Aktif teklifler</div>
            <div className="stat-value">{activeOfferCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Devam eden işler</div>
            <div className="stat-value">{acceptedJobCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tamamlanan işler</div>
            <div className="stat-value">{completedBids.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Saatlik servis ücreti</div>
            <div className="stat-value">{artisanProfile?.hourly_rate ? `${artisanProfile.hourly_rate} ₺` : 'Belirtilmemiş'}</div>
          </div>
        </div>

        <div className="tabs mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('opportunities')}
            className="tab"
          >
            İş fırsatları ({opportunities.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my_bids')}
            className={`tab ${activeTab === 'my_bids' ? 'tab-active' : ''}`}
          >
            Tekliflerim ({activeBids.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`tab ${activeTab === 'completed' ? 'tab-active' : ''}`}
          >
            Tamamladıklarım ({completedBids.length})
          </button>
        </div>

        {String(activeTab) === 'opportunities' && (
          <div>
            <div className="section-head">
              <div>
                <h2 className="section-title">Bölgenizdeki iş fırsatları</h2>
                <p className="page-subtitle">
                  Müşterilerin oluşturduğu açık talepleri inceleyin, hızlıca fiyat ve süre teklifi verin.
                </p>
              </div>
              <button type="button" onClick={fetchData} className="btn btn-secondary btn-sm">
                Yenile
              </button>
            </div>

            {loading ? (
              <div className="loading-text">Yükleniyor...</div>
            ) : opportunities.length === 0 ? (
              <div className="empty-state">
                {!artisanProfile ? (
                  <>
                    <h3 className="empty-title">Usta profiliniz yüklenemedi</h3>
                    <p>Profil bilgilerinizi yenileyin veya daha sonra tekrar deneyin.</p>
                  </>
                ) : artisanProfile.is_approved === false ? (
                  <>
                    <h3 className="empty-title">Usta profiliniz henüz onaylanmadı</h3>
                    <p>İş fırsatlarını görebilmek için yönetici onayı gereklidir.</p>
                  </>
                ) : artisanProfile?.is_available === false ? (
                  <>
                    <h3 className="empty-title">Müsaitlik durumunuz kapalı</h3>
                    <p>Yeni fırsatları görmek için profilinizden müsaitliği açın.</p>
                  </>
                ) : !artisanCenter ? (
                  <>
                    <h3 className="empty-title">Hizmet konumunuz eksik</h3>
                    <p>
                      İş fırsatları kategori ve mesafeye göre eşleştirilir. Profilinizden hizmet
                      merkezini seçip kaydedin.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="empty-title">Eşleşen açık iş talebi bulunmuyor</h3>
                    <p>
                      Yalnızca uzmanlık alanınıza ve hizmet yarıçapınıza uyan açık talepler listelenir.
                      Yeni talep geldiğinde burada görünecek.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="list">
                {opportunities.map((item) => {
                  const existingBid = myBids.find((bid) => bid.request_id === item.id);
                  const requestPoint =
                    typeof item.latitude === 'number' && typeof item.longitude === 'number'
                      ? { latitude: item.latitude, longitude: item.longitude }
                      : null;
                  const distanceKm =
                    artisanCenter && requestPoint
                      ? haversineDistanceKm(artisanCenter, requestPoint)
                      : null;

                  return (
                    <div
                      key={item.id}
                      className="card bid-card-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => openOpportunity(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openOpportunity(item);
                        }
                      }}
                    >
                      <div className="card-body">
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                          {item.images && item.images.length > 0 && (
                            <img
                              src={item.images[0]}
                              alt={item.title}
                              className="list-thumb"
                              style={{ width: 110, height: 100 }}
                            />
                          )}

                          <div style={{ flex: 1, minWidth: 240 }}>
                            <div className="flex flex-wrap" style={{ marginBottom: '0.4rem', gap: '0.5rem' }}>
                              <span className={`badge ${item.urgency === 'urgent' ? 'badge-danger' : 'badge-neutral'}`}>
                                {item.urgency === 'urgent' ? 'Acil' : 'Normal'}
                              </span>
                              <span className="small muted">{formatDate(item.created_at) || 'Yeni'}</span>
                              <span className="small muted">
                                Müşteri: <strong style={{ color: 'var(--ink)' }}>{item.customer_name || 'Müşteri'}</strong>
                              </span>
                            </div>

                            <h3 className="list-title">{item.title}</h3>
                            <p className="list-sub">
                              {formatLocation(item.city, item.district, item.address) || 'Konum belirtilmedi'}
                            </p>

                            {requestPoint && (
                              <div
                                className="flex flex-wrap"
                                style={{ gap: '0.5rem', marginTop: '0.35rem', alignItems: 'center' }}
                              >
                                {distanceKm !== null && (
                                  <span className="badge badge-neutral" title="Hizmet merkezinizden kuş uçuşu mesafe">
                                    ~{formatDistanceKm(distanceKm)} uzakta
                                  </span>
                                )}
                                <a
                                  href={googleMapsPlaceUrl(requestPoint.latitude, requestPoint.longitude)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="small"
                                  style={{ color: 'var(--primary)', fontWeight: 650 }}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                >
                                  Haritada gör
                                </a>
                                <a
                                  href={googleMapsDirectionsUrl(requestPoint, artisanCenter)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="small"
                                  style={{ color: 'var(--primary)', fontWeight: 650 }}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                >
                                  Yol tarifi al ↗
                                </a>
                              </div>
                            )}
                            <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.55 }}>
                              {item.description}
                            </p>
                          </div>

                          <div style={{ minWidth: 160, textAlign: 'right' }}>
                            {existingBid ? (
                              existingBid.status === 'rejected' ? (
                                <div>
                                  <span className="badge badge-danger">Teklifiniz reddedildi</span>
                                  <div className="small muted mt-1">Son teklifiniz</div>
                                  <div className="price">{existingBid.price} ₺</div>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openOpportunity(item, true);
                                    }}
                                    onKeyDown={(event) => event.stopPropagation()}
                                    className="btn btn-primary btn-sm mt-2"
                                  >
                                    Tekrar teklif ver
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <span className={`badge ${existingBid.is_accepted ? 'badge-success' : 'badge-warning'}`}>
                                    {existingBid.is_accepted ? 'Teklif kabul edildi' : 'Teklif inceleniyor'}
                                  </span>
                                  <div className="small muted mt-1">Teklifiniz</div>
                                  <div className="price">{existingBid.price} ₺</div>
                                </div>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openOpportunity(item, true);
                                }}
                                onKeyDown={(event) => event.stopPropagation()}
                                className="btn btn-primary btn-sm"
                              >
                                Teklif ver
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="bid-detail-hint" style={{ marginTop: '0.55rem' }}>
                          Detayları ve yol haritasını gör →
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'my_bids' && (
          <div>
            {activeBids.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-title">Devam eden teklifiniz bulunmuyor</h3>
                <p style={{ marginBottom: '1.25rem' }}>
                  {myBids.length > 0
                    ? 'Tamamlanan işleriniz "Tamamladıklarım" sekmesinde listeleniyor.'
                    : 'İş fırsatları sekmesinden açık işlere hızlıca fiyat verebilirsiniz.'}
                </p>
                {myBids.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('completed')}
                    className="btn btn-secondary"
                  >
                    Tamamladıklarıma git
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('opportunities')}
                    className="btn btn-primary"
                  >
                    İş fırsatlarına göz at
                  </button>
                )}
              </div>
            ) : (
              <div className="list">{activeBids.map(renderBidCard)}</div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div>
            {completedBids.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-title">Henüz tamamlanmış işiniz yok</h3>
                <p>
                  Müşteri işi tamamlandı olarak onayladığında burada listelenecek.
                </p>
              </div>
            ) : (
              <div className="list">{completedBids.map(renderBidCard)}</div>
            )}
          </div>
        )}

        {selectedOpportunity && (
          <div
            className="location-map-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="İş fırsatı detayı"
            onClick={closeOpportunity}
          >
            <div
              className="location-map-modal bid-detail-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="location-map-modal-head">
                <div>
                  <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>
                    İş fırsatı detayı
                  </p>
                  <h3 className="section-title" style={{ marginBottom: '0.2rem' }}>
                    {selectedOpportunity.title}
                  </h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {categoryLabels[selectedOpportunity.category] || selectedOpportunity.category}
                    {' · '}
                    {formatDate(selectedOpportunity.created_at) || 'Yeni'}
                  </p>
                </div>
                <button type="button" onClick={closeOpportunity} className="btn btn-ghost btn-sm">
                  Kapat
                </button>
              </div>

              <div className="bid-detail-body">
                <div className="bid-detail-badges">
                  <span
                    className={`badge ${
                      selectedOpportunity.urgency === 'urgent' ? 'badge-danger' : 'badge-neutral'
                    }`}
                  >
                    {selectedOpportunity.urgency === 'urgent' ? 'Acil' : 'Normal'}
                  </span>
                  {selectedOpportunityDistance !== null && (
                    <span className="badge badge-neutral" title="Hizmet merkezinizden kuş uçuşu mesafe">
                      ~{formatDistanceKm(selectedOpportunityDistance)} uzakta
                    </span>
                  )}
                  {selectedOpportunityBid && (
                    <span
                      className={`badge ${
                        selectedOpportunityBid.is_accepted
                          ? 'badge-success'
                          : selectedOpportunityBid.status === 'rejected'
                            ? 'badge-danger'
                            : 'badge-warning'
                      }`}
                    >
                      {selectedOpportunityBid.is_accepted
                        ? 'Teklifiniz kabul edildi'
                        : selectedOpportunityBid.status === 'rejected'
                          ? 'Teklifiniz reddedildi'
                          : 'Teklifiniz inceleniyor'}
                    </span>
                  )}
                </div>

                {selectedOpportunityBid?.status === 'rejected' && (
                  <div className="alert alert-warning">
                    Bu iş için verdiğiniz <strong>{selectedOpportunityBid.price} ₺</strong> tutarındaki
                    teklif müşteri tarafından reddedildi. Dilerseniz güncel fiyat ve süre ile
                    <strong> tekrar teklif verebilirsiniz</strong>.
                  </div>
                )}

                <div className="bid-detail-grid">
                  <div className="bid-detail-item">
                    <span className="small muted">Müşteri</span>
                    <strong>{selectedOpportunity.customer_name || 'Müşteri'}</strong>
                  </div>
                  <div className="bid-detail-item">
                    <span className="small muted">Kategori</span>
                    <strong>
                      {categoryLabels[selectedOpportunity.category] || selectedOpportunity.category}
                    </strong>
                  </div>
                  <div className="bid-detail-item">
                    <span className="small muted">Talep tarihi</span>
                    <strong>{formatDate(selectedOpportunity.created_at) || 'Yeni'}</strong>
                  </div>
                  <div className="bid-detail-item">
                    <span className="small muted">Mesafe</span>
                    <strong>
                      {selectedOpportunityDistance !== null
                        ? `~${formatDistanceKm(selectedOpportunityDistance)} (kuş uçuşu)`
                        : 'Belirtilmedi'}
                    </strong>
                  </div>
                </div>

                <div className="bid-detail-item">
                  <span className="small muted">Hizmet adresi</span>
                  <strong>
                    {formatLocation(
                      selectedOpportunity.city,
                      selectedOpportunity.district,
                      selectedOpportunity.address
                    ) || 'Belirtilmedi'}
                  </strong>
                </div>

                {selectedOpportunity.description && (
                  <div className="bid-detail-item">
                    <span className="small muted">Talep açıklaması</span>
                    <p className="bid-detail-description">{selectedOpportunity.description}</p>
                  </div>
                )}

                {selectedOpportunity.images && selectedOpportunity.images.length > 0 && (
                  <div className="bid-detail-item">
                    <span className="small muted">Talep fotoğrafları</span>
                    <div className="bid-detail-images">
                      {selectedOpportunity.images.map((image, index) => (
                        <img
                          key={`${image}-${index}`}
                          src={image}
                          alt={`Talep fotoğrafı ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="bid-detail-item">
                  <span className="small muted">Yol haritası</span>
                  {selectedOpportunityPoint && artisanCenter ? (
                    <RouteMapDemo
                      origin={artisanCenter}
                      destination={selectedOpportunityPoint}
                      originLabel="Konumunuz"
                      destinationLabel="İş konumu"
                      height={260}
                    />
                  ) : selectedOpportunityPoint ? (
                    <div className="alert alert-warning">
                      Yol haritasını göstermek için profilinize konum ekleyin.{' '}
                      <Link href="/artisan-dashboard/profile" onClick={closeOpportunity}>
                        Profilimi düzenle
                      </Link>
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      Bu talepte kayıtlı bir konum bulunmuyor.
                    </div>
                  )}
                </div>

                {activeRequestId === selectedOpportunity.id && canBidOnSelectedOpportunity && (
                  <div
                    style={{
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <h4 className="section-title" style={{ fontSize: '1rem', marginBottom: '0.85rem' }}>
                      {selectedOpportunityBid?.status === 'rejected' ? 'Tekrar teklif sun' : 'Teklif sun'}
                    </h4>

                    {bidError && <div className="alert alert-error mb-2">{bidError}</div>}

                    <div className="form-row" style={{ marginBottom: '1rem' }}>
                      <div className="field">
                        <label className="label">Teklif tutarı (₺)</label>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="Örn: 650"
                        />
                      </div>

                      <div className="field">
                        <label className="label">Tahmini varış / tamamlanma</label>
                        <input
                          type="text"
                          className="input"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          placeholder="Örn: 30 dakika içinde varış"
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="label">Müşteriye not</label>
                      <textarea
                        rows={2}
                        className="textarea"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="İşe dair kısa bir açıklama ekleyin (isteğe bağlı)"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                {activeRequestId === selectedOpportunity.id && canBidOnSelectedOpportunity ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRequestId(null);
                        setBidError('');
                      }}
                      className="btn btn-ghost"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendBid(selectedOpportunity.id)}
                      disabled={submittingBid}
                      className="btn btn-primary"
                    >
                      {submittingBid ? 'Gönderiliyor...' : 'Teklifi gönder'}
                    </button>
                  </>
                ) : (
                  <>
                    {selectedOpportunityPoint && (
                      <>
                        <a
                          href={googleMapsPlaceUrl(
                            selectedOpportunityPoint.latitude,
                            selectedOpportunityPoint.longitude
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                        >
                          Haritada aç
                        </a>
                        <a
                          href={googleMapsDirectionsUrl(
                            selectedOpportunityPoint,
                            artisanCenter
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                        >
                          Yol tarifi al ↗
                        </a>
                      </>
                    )}
                    {canBidOnSelectedOpportunity && (
                      <button
                        type="button"
                        onClick={() => openOpportunity(selectedOpportunity, true)}
                        className="btn btn-primary"
                      >
                        {selectedOpportunityBid?.status === 'rejected' ? 'Tekrar teklif ver' : 'Teklif ver'}
                      </button>
                    )}
                    <button type="button" onClick={closeOpportunity} className="btn btn-ghost">
                      Kapat
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedBid && (
          <div
            className="location-map-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Teklif detayı"
            onClick={() => setSelectedBid(null)}
          >
            <div
              className="location-map-modal bid-detail-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="location-map-modal-head">
                <div>
                  <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>
                    Teklif detayı
                  </p>
                  <h3 className="section-title" style={{ marginBottom: '0.2rem' }}>
                    {selectedBid.request_title}
                  </h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {categoryLabels[selectedBid.request_category] || selectedBid.request_category}
                    {' · '}
                    {formatDate(selectedBid.request_created_at || selectedBid.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBid(null)}
                  className="btn btn-ghost btn-sm"
                >
                  Kapat
                </button>
              </div>

              <div className="bid-detail-body">
                <div className="bid-detail-badges">
                  <span
                    className={`badge ${
                      (requestStatusMap[selectedBid.request_status] || requestStatusMap.pending).cls
                    }`}
                  >
                    Talep:{' '}
                    {
                      (requestStatusMap[selectedBid.request_status] || requestStatusMap.pending)
                        .label
                    }
                  </span>
                  <span className={`badge ${getBidStatus(selectedBid).cls}`}>
                    {getBidStatus(selectedBid).label}
                  </span>
                  <span
                    className={`badge ${
                      selectedBid.request_urgency === 'urgent'
                        ? 'badge-danger'
                        : 'badge-neutral'
                    }`}
                  >
                    {selectedBid.request_urgency === 'urgent' ? 'Acil' : 'Normal'}
                  </span>
                </div>

                <div className="bid-detail-grid">
                  <div className="bid-detail-item">
                    <span className="small muted">Müşteri</span>
                    <strong>{selectedBid.customer_name}</strong>
                  </div>
                  <div className="bid-detail-item">
                    <span className="small muted">Teklif tutarı</span>
                    <strong className="price">{selectedBid.price} ₺</strong>
                  </div>
                  <div className="bid-detail-item">
                    <span className="small muted">Tahmini süre</span>
                    <strong>{selectedBid.estimated_duration || 'Belirtilmedi'}</strong>
                  </div>
                  <div className="bid-detail-item">
                    <span className="small muted">Teklif tarihi</span>
                    <strong>{formatDate(selectedBid.created_at)}</strong>
                  </div>
                </div>

                <div className="bid-detail-item">
                  <span className="small muted">Hizmet adresi</span>
                  <strong>
                    {formatLocation(
                      selectedBid.request_city,
                      selectedBid.request_district,
                      selectedBid.request_address
                    ) || 'Belirtilmedi'}
                  </strong>
                </div>

                {selectedBid.request_description && (
                  <div className="bid-detail-item">
                    <span className="small muted">Talep açıklaması</span>
                    <p className="bid-detail-description">{selectedBid.request_description}</p>
                  </div>
                )}

                {selectedBid.request_images && selectedBid.request_images.length > 0 && (
                  <div className="bid-detail-item">
                    <span className="small muted">Talep fotoğrafları</span>
                    <div className="bid-detail-images">
                      {selectedBid.request_images.map((image, index) => (
                        <img
                          key={`${image}-${index}`}
                          src={image}
                          alt={`Talep fotoğrafı ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {selectedBid.customer_phone && (
                  <div className="alert alert-success">
                    Müşteri iletişim numarası:{' '}
                    <a
                      href={`tel:${selectedBid.customer_phone}`}
                      style={{ fontWeight: 700, color: 'var(--success)' }}
                    >
                      {selectedBid.customer_phone}
                    </a>
                  </div>
                )}

                <div
                  className="alert"
                  style={{
                    background: 'var(--surface-muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--ink-soft)',
                  }}
                >
                  <strong>Teklif notunuz:</strong> {selectedBid.note || 'Özel not belirtilmedi.'}
                </div>

                <div className="bid-detail-item">
                  <span className="small muted">Yol haritası</span>
                  {selectedRequestPoint && artisanCenter ? (
                    <RouteMapDemo
                      origin={artisanCenter}
                      destination={selectedRequestPoint}
                      originLabel="Konumunuz"
                      destinationLabel="İş konumu"
                      height={260}
                    />
                  ) : selectedRequestPoint ? (
                    <div className="alert alert-warning">
                      Yol haritasını göstermek için profilinize konum ekleyin.{' '}
                      <Link
                        href="/artisan-dashboard/profile"
                        onClick={() => setSelectedBid(null)}
                      >
                        Profilimi düzenle
                      </Link>
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      Bu talepte kayıtlı bir konum bulunmuyor.
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                {!selectedBid.is_accepted &&
                  selectedBid.status === 'pending' &&
                  selectedBid.request_status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleWithdrawBid(selectedBid)}
                      disabled={withdrawingBidId === selectedBid.id}
                      className="btn btn-danger"
                      title="Teklifinizi geri çekin"
                    >
                      {withdrawingBidId === selectedBid.id ? 'Geri çekiliyor...' : 'Teklifi çek'}
                    </button>
                  )}
                {selectedBid.is_accepted && selectedBid.request_status === 'in_progress' && (
                  <button
                    type="button"
                    onClick={() => handleCompleteJob(selectedBid)}
                    disabled={completingJob}
                    className="btn btn-success"
                    title="İşi tamamlandı olarak işaretle"
                  >
                    {completingJob ? 'İşaretleniyor...' : 'İşi tamamlandı olarak işaretle'}
                  </button>
                )}
                {selectedRequestPoint && (
                  <>
                    <a
                      href={googleMapsPlaceUrl(
                        selectedRequestPoint.latitude,
                        selectedRequestPoint.longitude
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                    >
                      Haritada aç
                    </a>
                    <a
                      href={googleMapsDirectionsUrl(selectedRequestPoint, artisanCenter)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                    >
                      Yol tarifi al ↗
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedBid(null)}
                  className="btn btn-ghost"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
