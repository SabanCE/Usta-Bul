'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { formatCityDistrict } from '../../utils/location';
import { getAuthHeaders } from '../../utils/api';

interface PendingArtisan {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  category: string;
  city: string | null;
  district: string | null;
  experience_years: number;
  bio: string | null;
  created_at: string;
}

interface AdminStats {
  pending_artisans: number;
  approved_artisans: number;
  customers: number;
  completed_requests: number;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'customer' | 'artisan';
  created_at: string;
  suspended_at: string | null;
  suspension_reason: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  artisan_category?: string | null;
  artisan_bio?: string | null;
  experience_years?: number | null;
  artisan_rating?: number | null;
  artisan_total_reviews?: number | null;
  artisan_is_approved?: boolean | null;
  artisan_city?: string | null;
  artisan_district?: string | null;
}

interface AdminUserDetail {
  user: AdminUser;
  summary: Record<string, number>;
  activity: Record<string, Array<Record<string, unknown>>>;
}

type QueueTab = 'applications' | 'reviews' | 'bids' | 'requests' | 'reports' | 'support' | 'audit' | 'users';
type QueueItem = Record<string, unknown> & { id: string; status?: string; moderation_status?: string };

const queueTabs: Array<{ id: QueueTab; label: string; endpoint?: string }> = [
  { id: 'applications', label: 'Usta başvuruları' },
  { id: 'reviews', label: 'Yorumlar', endpoint: 'content/reviews' },
  { id: 'bids', label: 'Teklifler', endpoint: 'content/bids' },
  { id: 'requests', label: 'İş talepleri', endpoint: 'content/requests' },
  { id: 'reports', label: 'Şikâyetler', endpoint: 'reports' },
  { id: 'support', label: 'Destek', endpoint: 'support' },
  { id: 'audit', label: 'İşlem geçmişi', endpoint: 'audit-logs' },
  { id: 'users', label: 'Kullanıcılar' },
];

const categoryLabels: Record<string, string> = {
  plumber: 'Sıhhi Tesisat',
  electrician: 'Elektrik & Aydınlatma',
  painter: 'Boya & Badana',
  carpenter: 'Marangoz & Mobilya',
  locksmith: 'Çilingir & Kilit',
  appliance: 'Beyaz Eşya Servisi',
  renovation: 'Ev Tadilatı',
};

const statusNames: Record<string, string> = {
  open: 'Açık',
  investigating: 'İnceleniyor',
  resolved: 'Çözüldü',
  dismissed: 'Reddedildi',
  in_progress: 'İnceleniyor',
  closed: 'Kapatıldı',
  pending_review: 'İnceleme bekliyor',
  visible: 'Yayında',
  hidden: 'Gizli',
};

function formatDate(value: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<QueueTab>('applications');
  const [artisans, setArtisans] = useState<PendingArtisan[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>({});
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<QueueItem | null>(null);
  const [ticketMessages, setTicketMessages] = useState<QueueItem[]>([]);
  const [ticketReply, setTicketReply] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userStatus, setUserStatus] = useState('active');
  const [selectedProfile, setSelectedProfile] = useState<AdminUserDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [accountReason, setAccountReason] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pendingResponse, statsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/v1/admin/artisans/pending', { headers: getAuthHeaders() }),
        fetch('http://localhost:5000/api/v1/admin/stats', { headers: getAuthHeaders() }),
      ]);
      const [pendingData, statsData] = await Promise.all([
        pendingResponse.json().catch(() => null),
        statsResponse.json().catch(() => null),
      ]);
      if (!pendingResponse.ok) throw new Error(pendingData?.error?.message || 'Başvurular yüklenemedi.');
      if (!statsResponse.ok) throw new Error(statsData?.error?.message || 'İstatistikler yüklenemedi.');
      setArtisans(Array.isArray(pendingData?.data) ? pendingData.data as PendingArtisan[] : []);
      setStats(statsData?.data ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Yönetim verileri yüklenemedi.');
      setArtisans([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    const config = queueTabs.find((tab) => tab.id === activeTab);
    if (!config?.endpoint || activeTab === 'applications') return;
    setQueueLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (statusFilter && activeTab !== 'audit') params.set('status', statusFilter);
    if (activeTab === 'audit') params.set('limit', '100');
    try {
      const query = params.toString();
      const response = await fetch(
        `http://localhost:5000/api/v1/admin/${config.endpoint}${query ? `?${query}` : ''}`,
        { headers: getAuthHeaders(), cache: 'no-store' }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Yönetim listesi yüklenemedi.');
      setQueueItems(Array.isArray(data?.data) ? data.data as QueueItem[] : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Yönetim listesi yüklenemedi.');
      setQueueItems([]);
    } finally {
      setQueueLoading(false);
    }
  }, [activeTab, statusFilter]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setError('');
    const params = new URLSearchParams({ status: userStatus });
    if (userSearch.trim()) params.set('q', userSearch.trim());
    if (userRole) params.set('role', userRole);
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/users?${params}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Kullanıcılar yüklenemedi.');
      setUsers(Array.isArray(data?.data) ? data.data as AdminUser[] : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kullanıcılar yüklenemedi.');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [userRole, userSearch, userStatus]);

  const openUserProfile = async (id: string) => {
    setActiveTab('users');
    setSelectedProfile(null);
    setProfileLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/users/${id}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Kullanıcı profili yüklenemedi.');
      setSelectedProfile(data?.data as AdminUserDetail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kullanıcı profili yüklenemedi.');
    } finally {
      setProfileLoading(false);
    }
  };

  const changeAccountStatus = async (status: 'active' | 'suspended' | 'deleted') => {
    if (!selectedProfile) return;
    const user = selectedProfile.user;
    const descriptions = {
      active: 'kısıtlamayı kaldırıp hesabı yeniden etkinleştirmek',
      suspended: 'hesabı geçici olarak kısıtlamak',
      deleted: 'hesabı geri alınabilir şekilde kapatmak',
    };
    if (!window.confirm(`${user.full_name} hesabını ${descriptions[status]} istediğinize emin misiniz?`)) return;
    setActionId(user.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, reason: accountReason.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Hesap durumu güncellenemedi.');
      setSelectedProfile((current) => current ? { ...current, user: data.data as AdminUser } : current);
      setNotice(status === 'active' ? 'Hesap yeniden etkinleştirildi.' : status === 'suspended' ? 'Hesap kısıtlandı.' : 'Hesap geri alınabilir şekilde kapatıldı.');
      setAccountReason('');
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Hesap durumu güncellenemedi.');
    } finally {
      setActionId(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== 'admin') {
      router.replace(user ? '/' : '/login');
      return;
    }
    void loadApplications();
  }, [authLoading, user, router, loadApplications]);

  useEffect(() => {
    if (!authLoading && user?.role === 'admin') void loadQueue();
  }, [authLoading, user, loadQueue]);

  useEffect(() => {
    if (!authLoading && user?.role === 'admin' && activeTab === 'users') void loadUsers();
  }, [authLoading, user, activeTab, loadUsers]);

  const callAdmin = async (
    endpoint: string,
    method: 'PATCH' | 'POST',
    body: Record<string, unknown>,
    successText: string
  ): Promise<QueueItem | null> => {
    setError('');
    setNotice('');
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/${endpoint}`, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'İşlem tamamlanamadı.');
      setNotice(successText);
      await loadQueue();
      return (data?.data as QueueItem | undefined) ?? null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı.');
      return null;
    }
  };

  const decideApplication = async (id: string, isApproved: boolean) => {
    const action = isApproved ? 'onaylamak' : 'reddetmek';
    if (!window.confirm(`Bu usta başvurusunu ${action} istediğinize emin misiniz?`)) return;
    setActionId(id);
    setError('');
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/artisans/${id}/approval`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isApproved }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Başvuru kararı kaydedilemedi.');
      setArtisans((current) => current.filter((artisan) => artisan.id !== id));
      setStats((current) => current ? {
        ...current,
        pending_artisans: Math.max(0, current.pending_artisans - 1),
        approved_artisans: isApproved ? current.approved_artisans + 1 : current.approved_artisans,
      } : current);
      setNotice(isApproved ? 'Usta başvurusu onaylandı.' : 'Usta başvurusu reddedildi.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Başvuru kararı kaydedilemedi.');
    } finally {
      setActionId(null);
    }
  };

  const openTicket = async (item: QueueItem) => {
    setError('');
    try {
      const response = await fetch(`http://localhost:5000/api/v1/admin/support/${item.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Destek konuşması yüklenemedi.');
      const ticket = data.data as QueueItem & { messages?: QueueItem[] };
      setSelectedTicket(ticket);
      setTicketMessages(Array.isArray(ticket.messages) ? ticket.messages : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Destek konuşması yüklenemedi.');
    }
  };

  const sendTicketReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTicket || !ticketReply.trim()) return;
    const result = await callAdmin(
      `support/${selectedTicket.id}/messages`,
      'POST',
      { message: ticketReply },
      'Yanıt gönderildi.'
    );
    if (result) {
      setTicketReply('');
      await openTicket(selectedTicket);
    }
  };

  const pendingCount = stats?.pending_artisans ?? artisans.length;
  if (authLoading || !user || user.role !== 'admin') {
    return <div className="page"><div className="container"><div className="loading-text">Yönetim paneli yükleniyor...</div></div></div>;
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="eyebrow">Yönetim</p>
            <h1 className="page-title">Operasyon yönetimi</h1>
            <p className="page-subtitle">Yetkili: <strong style={{ color: 'var(--ink)' }}>{user.fullName || 'Sistem Yöneticisi'}</strong></p>
          </div>
          <Link href="/requests" className="btn btn-secondary">Tüm iş taleplerini incele</Link>
        </div>

        {error && <div className="alert alert-error mb-3" role="alert">{error}</div>}
        {notice && <div className="alert alert-success mb-3" role="status">{notice}</div>}

        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Onay bekleyen başvurular</div><div className="stat-value">{loading ? '—' : pendingCount.toLocaleString('tr-TR')}</div></div>
          <div className="stat-card"><div className="stat-label">Aktif onaylı ustalar</div><div className="stat-value">{loading ? '—' : (stats?.approved_artisans ?? 0).toLocaleString('tr-TR')}</div></div>
          <div className="stat-card"><div className="stat-label">Kayıtlı müşteri sayısı</div><div className="stat-value">{loading ? '—' : (stats?.customers ?? 0).toLocaleString('tr-TR')}</div></div>
          <div className="stat-card"><div className="stat-label">Tamamlanan işler</div><div className="stat-value">{loading ? '—' : (stats?.completed_requests ?? 0).toLocaleString('tr-TR')}</div></div>
        </div>

        <div className="tabs mb-3" role="tablist" aria-label="Yönetim bölümleri">
          {queueTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedTicket(null);
                if (tab.id !== 'users') setSelectedProfile(null);
                setError('');
                setNotice('');
                setStatusFilter(tab.id === 'reports' || tab.id === 'support' ? 'open' : 'pending_review');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'users' ? (
          <section>
            <div className="section-head">
              <div>
                <h2 className="section-title">Kullanıcı ara ve yönet</h2>
                <p className="page-subtitle">Müşteri ve usta hesaplarını, işlem özetlerini ve hesap durumlarını inceleyin.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadUsers()} disabled={usersLoading}>
                {usersLoading ? 'Yükleniyor...' : 'Yenile'}
              </button>
            </div>
            <div className="card mb-3">
              <div className="card-body">
                <div className="form-grid">
                  <div className="field">
                    <label className="label" htmlFor="admin-user-search">Ad, e-posta, telefon veya kullanıcı ID</label>
                    <input id="admin-user-search" className="input" value={userSearch} maxLength={100} onChange={(event) => setUserSearch(event.target.value)} placeholder="Kullanıcı ara" />
                  </div>
                  <div className="flex flex-wrap">
                    <select className="select" aria-label="Kullanıcı rolü" value={userRole} onChange={(event) => setUserRole(event.target.value)} style={{ width: 'auto', minWidth: 150 }}>
                      <option value="">Tüm roller</option><option value="customer">Müşteri</option><option value="artisan">Usta</option>
                    </select>
                    <select className="select" aria-label="Hesap durumu" value={userStatus} onChange={(event) => setUserStatus(event.target.value)} style={{ width: 'auto', minWidth: 170 }}>
                      <option value="active">Aktif hesaplar</option><option value="suspended">Kısıtlı hesaplar</option><option value="deleted">Kapatılan hesaplar</option><option value="all">Tüm hesaplar</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {usersLoading ? <div className="loading-text">Kullanıcılar yükleniyor...</div> : users.length === 0 ? (
              <div className="empty-state"><h3>Kullanıcı bulunamadı</h3><p>Arama terimini veya hesap durumu filtresini değiştirin.</p></div>
            ) : (
              <div className="list">
                {users.map((account) => (
                  <article key={account.id} className="card">
                    <div className="card-body flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div className="flex flex-wrap mb-1">
                          <span className="badge badge-neutral">{account.role === 'artisan' ? 'Usta' : 'Müşteri'}</span>
                          <span className="badge badge-neutral">{account.deleted_at ? 'Hesap kapalı' : account.suspended_at ? 'Kısıtlı' : 'Aktif'}</span>
                        </div>
                        <h3 className="list-title">{account.full_name}</h3>
                        <p className="list-sub">{[account.email, account.phone].filter(Boolean).join(' · ')}</p>
                        <p className="small muted mt-1">Kayıt: {formatDate(account.created_at)}</p>
                      </div>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => void openUserProfile(account.id)}>Profili ve işlemleri incele</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {profileLoading && <div className="loading-text mt-3">Kullanıcı profili yükleniyor...</div>}
            {selectedProfile && (
              <section className="card mt-3">
                <div className="card-body">
                  <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <p className="eyebrow">{selectedProfile.user.role === 'artisan' ? 'Usta profili' : 'Müşteri profili'}</p>
                      <h2 className="section-title">{selectedProfile.user.full_name}</h2>
                      <p className="list-sub">{[selectedProfile.user.email, selectedProfile.user.phone].filter(Boolean).join(' · ')}</p>
                      <p className="small muted mt-1">Kullanıcı ID: {selectedProfile.user.id} · Kayıt: {formatDate(selectedProfile.user.created_at)}</p>
                      {selectedProfile.user.role === 'artisan' && (
                        <div className="card mt-2">
                          <div className="card-body">
                            <strong>{categoryLabels[selectedProfile.user.artisan_category || ''] || selectedProfile.user.artisan_category || 'Usta profili'}</strong>
                            <p className="small muted mt-1">
                              {[formatCityDistrict(selectedProfile.user.artisan_city || null, selectedProfile.user.artisan_district || null),
                                selectedProfile.user.experience_years !== null && selectedProfile.user.experience_years !== undefined ? `${selectedProfile.user.experience_years} yıl deneyim` : '',
                                selectedProfile.user.artisan_is_approved ? 'Onaylı' : 'Onay bekliyor',
                                selectedProfile.user.artisan_rating ? `Puan ${selectedProfile.user.artisan_rating}` : 'Puan yok',
                                `${selectedProfile.user.artisan_total_reviews || 0} yorum`].filter(Boolean).join(' · ')}
                            </p>
                            {selectedProfile.user.artisan_bio && <p className="mt-1">{selectedProfile.user.artisan_bio}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedProfile(null)}>Profili kapat</button>
                  </div>
                  <div className="stat-grid mt-2">
                    {Object.entries(selectedProfile.summary).map(([key, value]) => (
                      <div key={key} className="stat-card">
                        <div className="stat-label">{({
                          requests: 'İş talepleri',
                          bids: 'Verilen teklifler',
                          reviews_written: 'Yazdığı yorumlar',
                          reviews_received: 'Aldığı yorumlar',
                          reports_filed: 'Oluşturduğu şikâyetler',
                          reports_received: 'Hakkındaki şikâyetler',
                          support_tickets: 'Destek kayıtları',
                        } as Record<string, string>)[key] || key}</div>
                        <div className="stat-value">{Number(value).toLocaleString('tr-TR')}</div>
                      </div>
                    ))}
                  </div>
                  <div className="card mt-3">
                    <div className="card-body">
                      <h3 className="section-title">Hesap yönetimi</h3>
                      <p className="small muted mt-1">
                        Durum: {selectedProfile.user.deleted_at ? 'Geri alınabilir şekilde kapalı' : selectedProfile.user.suspended_at ? 'Kısıtlı' : 'Aktif'}
                        {selectedProfile.user.suspension_reason ? ` · Kısıtlama nedeni: ${selectedProfile.user.suspension_reason}` : ''}
                        {selectedProfile.user.deletion_reason ? ` · Kapatma nedeni: ${selectedProfile.user.deletion_reason}` : ''}
                      </p>
                      <div className="field mt-2">
                        <label className="label" htmlFor="account-action-reason">İşlem nedeni (kısıtlama/kapatma için zorunlu)</label>
                        <textarea id="account-action-reason" className="textarea" maxLength={2000} value={accountReason} onChange={(event) => setAccountReason(event.target.value)} />
                      </div>
                      <div className="flex flex-wrap mt-2">
                        <button type="button" className="btn btn-primary btn-sm" disabled={actionId === selectedProfile.user.id || !accountReason.trim()} onClick={() => void changeAccountStatus('suspended')}>Hesabı kısıtla</button>
                        <button type="button" className="btn btn-outline-danger btn-sm" disabled={actionId === selectedProfile.user.id || !accountReason.trim()} onClick={() => void changeAccountStatus('deleted')}>Hesabı geri alınabilir kapat</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={actionId === selectedProfile.user.id} onClick={() => void changeAccountStatus('active')}>Hesabı yeniden etkinleştir</button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <h3 className="section-title">Son işlemler</h3>
                    {Object.entries(selectedProfile.activity).map(([key, entries]) => (
                      <div key={key} className="mt-2">
                        <h4 className="list-title">{({
                          requests: 'İş talepleri',
                          bids: 'Verdiği teklifler',
                          reviews: 'Yazdığı / aldığı yorumlar',
                          reports: 'Oluşturduğu şikâyetler',
                          supportTickets: 'Destek kayıtları',
                          adminActions: 'Yönetici işlemleri',
                        } as Record<string, string>)[key] || key}</h4>
                        {entries.length === 0 ? <p className="small muted">Kayıt yok.</p> : (
                          <div className="list mt-1">
                            {entries.map((entry) => (
                              <article key={String(entry.id)} className="card">
                                <div className="card-body">
                                  <strong>{String(entry.title || entry.request_title || entry.subject || entry.comment || entry.reason || entry.action || 'Kayıt')}</strong>
                                  <p className="small muted mt-1">
                                    {[entry.status, entry.moderation_status, entry.rating ? `${String(entry.rating)}/5` : '', entry.created_at ? formatDate(String(entry.created_at)) : ''].filter(Boolean).map(String).join(' · ')}
                                  </p>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </section>
        ) : activeTab === 'applications' ? (
          <section>
            <div className="section-head">
              <div>
                <h2 className="section-title">Onay bekleyen usta başvuruları</h2>
                <p className="page-subtitle">Başvuruları inceleyin; kararlarınız denetim geçmişine kaydedilir.</p>
              </div>
              <button type="button" onClick={() => void loadApplications()} className="btn btn-secondary btn-sm" disabled={loading}>
                {loading ? 'Yükleniyor...' : 'Yenile'}
              </button>
            </div>
            {loading ? <div className="loading-text">Başvurular yükleniyor...</div> : artisans.length === 0 ? (
              <div className="empty-state"><h3>Onay bekleyen başvuru yok</h3><p>Yeni usta başvuruları geldiğinde burada listelenecek.</p></div>
            ) : (
              <div className="list">
                {artisans.map((artisan) => (
                  <article key={artisan.id} className="card">
                    <div className="card-body">
                      <div className="flex-between" style={{ alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 250 }}>
                          <div className="flex flex-wrap mb-1">
                            <span className="badge badge-neutral">{categoryLabels[artisan.category] || artisan.category}</span>
                            <span className="small muted">Başvuru: {formatDate(artisan.created_at)}</span>
                          </div>
                          <h3 className="list-title">{artisan.full_name}</h3>
                          <p className="list-sub">{[formatCityDistrict(artisan.city, artisan.district), artisan.phone, artisan.email].filter(Boolean).join(' · ')}</p>
                          {artisan.bio && <p className="mt-1" style={{ color: 'var(--ink-soft)' }}>{artisan.bio}</p>}
                          <p className="small muted mt-1">Deneyim: {artisan.experience_years} yıl</p>
                          <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => void openUserProfile(artisan.id)}>Usta profilini ve işlemlerini incele</button>
                        </div>
                        <div className="flex">
                          <button type="button" onClick={() => void decideApplication(artisan.id, false)} disabled={actionId === artisan.id} className="btn btn-outline-danger btn-sm">Reddet</button>
                          <button type="button" onClick={() => void decideApplication(artisan.id, true)} disabled={actionId === artisan.id} className="btn btn-success btn-sm">{actionId === artisan.id ? 'İşleniyor...' : 'Onayla'}</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section>
            <div className="section-head">
              <div>
                <h2 className="section-title">{queueTabs.find((tab) => tab.id === activeTab)?.label}</h2>
                <p className="page-subtitle">Kayıtları inceleyin ve yaptığınız değişiklikleri onaylayın.</p>
              </div>
              <div className="flex flex-wrap">
                {activeTab !== 'audit' && (
                  <select
                    className="select"
                    aria-label="Duruma göre filtrele"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    style={{ width: 'auto', minWidth: 180 }}
                  >
                    {activeTab === 'reports' ? (
                      <><option value="">Tüm şikâyetler</option><option value="open">Açık</option><option value="investigating">İnceleniyor</option><option value="resolved">Çözüldü</option><option value="dismissed">Reddedildi</option></>
                    ) : activeTab === 'support' ? (
                      <><option value="">Tüm destek kayıtları</option><option value="open">Açık</option><option value="in_progress">İnceleniyor</option><option value="resolved">Çözüldü</option><option value="closed">Kapatıldı</option></>
                    ) : (
                      <><option value="">Tüm içerikler</option><option value="pending_review">İnceleme bekliyor</option><option value="visible">Yayında</option><option value="hidden">Gizli</option></>
                    )}
                  </select>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadQueue()} disabled={queueLoading}>{queueLoading ? 'Yükleniyor...' : 'Yenile'}</button>
              </div>
            </div>
            {queueLoading ? <div className="loading-text">Kayıtlar yükleniyor...</div> : queueItems.length === 0 ? (
              <div className="empty-state"><h3>Kayıt bulunamadı</h3><p>Seçilen filtrede incelenecek kayıt yok.</p></div>
            ) : (
              <div className="list">
                {queueItems.map((item) => {
                  const currentStatus = activeTab === 'reports' || activeTab === 'support' ? String(item.status || '') : String(item.moderation_status || '');
                  const reportType = String(item.target_type || '');
                  const profileLinks: Array<{ id: string; label: string }> = [];
                  const addProfileLink = (id: unknown, label: string) => {
                    if (typeof id === 'string' && id && !profileLinks.some((profile) => profile.id === id)) {
                      profileLinks.push({ id, label });
                    }
                  };
                  if (activeTab === 'reviews') {
                    addProfileLink(item.customer_id, 'Müşteri profili');
                    addProfileLink(item.artisan_id, 'Usta profili');
                  } else if (activeTab === 'bids') {
                    addProfileLink(item.artisan_id, 'Teklif veren usta profili');
                    addProfileLink(item.customer_id, 'Talep sahibi profili');
                  } else if (activeTab === 'requests') {
                    addProfileLink(item.customer_id, 'Talep sahibi profili');
                  } else if (activeTab === 'reports') {
                    addProfileLink(item.reporter_id, 'Şikâyetçi profili');
                    addProfileLink(item.target_customer_id, 'İlgili müşteri profili');
                    addProfileLink(item.target_artisan_id, 'İlgili usta profili');
                  } else if (activeTab === 'support') {
                    addProfileLink(item.user_id, 'Kullanıcı profili');
                  } else if (activeTab === 'audit') {
                    addProfileLink(item.target_user_id, 'İlgili kullanıcı profili');
                    addProfileLink(item.target_customer_id, 'İlgili kullanıcı profili');
                    addProfileLink(item.target_artisan_id, 'Usta profili');
                  }
                  const targetHref = reportType === 'request'
                    ? `/requests/${String(item.target_id || '')}`
                    : reportType === 'bid' && item.related_request_id
                      ? `/requests/${String(item.related_request_id)}`
                      : (reportType === 'review' && typeof item.target_artisan_id === 'string') ||
                          (reportType === 'user' && item.target_user_role === 'artisan')
                        ? `/artisans/${String(item.target_artisan_id || item.target_id)}`
                        : item.related_request_id
                        ? `/requests/${String(item.related_request_id)}`
                        : '';
                  const content = activeTab === 'reviews'
                    ? `Yorum: ${String(item.comment || 'Yorum metni yok')} · Puan: ${String(item.rating ?? '-')}/5`
                    : activeTab === 'bids'
                      ? `Teklif: ${String(item.price ?? '-')} ₺ · ${String(item.note || 'Not yok')}`
                      : activeTab === 'requests'
                        ? `${String(item.title || 'Talep')} · ${String(item.description || '')}`
                        : activeTab === 'reports'
                          ? `${String(item.reason || '')} · ${String(item.description || '')}`
                          : activeTab === 'audit'
                            ? `${String(item.action || '')} · ${String(item.target_type || '')} · ${JSON.stringify(item.details || {})}`
                            : `${String(item.subject || '')}`;
                  return (
                    <article key={item.id} className="card">
                      <div className="card-body">
                        <div className="flex-between" style={{ alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 230 }}>
                            <div className="flex flex-wrap mb-1">
                              <span className="badge badge-neutral">{statusNames[currentStatus] || currentStatus || '—'}</span>
                              {activeTab === 'reviews' && <span className="small muted">{String(item.customer_name || '')} → {String(item.artisan_name || '')}</span>}
                              {activeTab === 'bids' && <span className="small muted">{String(item.artisan_name || '')} · {String(item.request_title || '')}</span>}
                              {activeTab === 'requests' && <span className="small muted">{String(item.customer_name || '')}</span>}
                              {activeTab === 'reports' && <span className="small muted">{String(item.reporter_name || '')} · {reportType} / {String(item.target_id || '')}</span>}
                              {activeTab === 'support' && <span className="small muted">{String(item.user_name || '')} · {Number(item.message_count || 0)} mesaj</span>}
                              {activeTab === 'audit' && <span className="small muted">{String(item.admin_name || '')}</span>}
                            </div>
                            <h3 className="list-title">{activeTab === 'support' ? String(item.subject || 'Destek kaydı') : content.split(' · ')[0]}</h3>
                            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-soft)', marginTop: '0.4rem' }}>{content}</p>
                            {typeof item.created_at === 'string' && <p className="small muted mt-1">{formatDate(item.created_at)}</p>}
                            {activeTab === 'reports' && typeof item.resolution_note === 'string' && <p className="small muted mt-1">Çözüm notu: {item.resolution_note}</p>}
                            {activeTab === 'reports' && typeof item.target_summary === 'string' && <p className="mt-1" style={{ whiteSpace: 'pre-wrap' }}>İlgili içerik: {item.target_summary}</p>}
                            {activeTab === 'reports' && targetHref && <Link href={targetHref} className="btn btn-ghost btn-sm mt-1">Hedefi incele</Link>}
                            {activeTab === 'support' && <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => void openTicket(item)}>Konuşmayı görüntüle</button>}
                            {activeTab === 'requests' && <Link href={`/requests/${item.id}`} className="btn btn-ghost btn-sm mt-1">Talep detayına git</Link>}
                            {profileLinks.length > 0 && (
                              <div className="flex flex-wrap mt-1">
                                {profileLinks.map((profile) => (
                                  <button key={`${profile.id}-${profile.label}`} type="button" className="btn btn-ghost btn-sm" onClick={() => void openUserProfile(profile.id)}>{profile.label}</button>
                                ))}
                              </div>
                            )}
                          </div>

                          {activeTab === 'reports' ? (
                            <div style={{ minWidth: 230, display: 'grid', gap: '0.5rem' }}>
                              <select className="select" value={itemStatuses[item.id] || currentStatus} onChange={(event) => setItemStatuses((current) => ({ ...current, [item.id]: event.target.value }))}>
                                <option value="open">Açık</option><option value="investigating">İnceleniyor</option><option value="resolved">Çözüldü</option><option value="dismissed">Reddedildi</option>
                              </select>
                              <input className="input" placeholder="Çözüm notu (isteğe bağlı)" value={resolutionNotes[item.id] || ''} maxLength={2000} onChange={(event) => setResolutionNotes((current) => ({ ...current, [item.id]: event.target.value }))} />
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => void callAdmin(`reports/${item.id}/status`, 'PATCH', { status: itemStatuses[item.id] || currentStatus, resolutionNote: resolutionNotes[item.id] || '' }, 'Şikâyet durumu güncellendi.')}>Durumu kaydet</button>
                            </div>
                          ) : activeTab === 'support' ? (
                            <div style={{ minWidth: 210, display: 'grid', gap: '0.5rem' }}>
                              <select className="select" value={itemStatuses[item.id] || currentStatus} onChange={(event) => setItemStatuses((current) => ({ ...current, [item.id]: event.target.value }))}>
                                <option value="open">Açık</option><option value="in_progress">İnceleniyor</option><option value="resolved">Çözüldü</option><option value="closed">Kapatıldı</option>
                              </select>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => void callAdmin(`support/${item.id}/status`, 'PATCH', { status: itemStatuses[item.id] || currentStatus }, 'Destek durumu güncellendi.')}>Durumu kaydet</button>
                            </div>
                          ) : (activeTab === 'reviews' || activeTab === 'bids' || activeTab === 'requests') ? (
                            <button
                              type="button"
                              className={currentStatus === 'hidden' ? 'btn btn-secondary btn-sm' : 'btn btn-outline-danger btn-sm'}
                              onClick={() => {
                                const nextStatus = currentStatus === 'hidden' ? 'visible' : 'hidden';
                                if (!window.confirm(nextStatus === 'hidden' ? 'İçerik kullanıcılardan gizlensin mi?' : 'İçerik yeniden yayımlansın mı?')) return;
                                void callAdmin(`content/${activeTab}/${item.id}/moderation`, 'PATCH', { status: nextStatus, reason: 'Yönetici panelinden güncellendi.' }, nextStatus === 'hidden' ? 'İçerik gizlendi.' : 'İçerik yeniden yayımlandı.');
                              }}
                            >
                              {currentStatus === 'hidden' ? 'Yeniden yayımla' : 'Gizle'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {selectedTicket && (
              <div className="card mt-3">
                <div className="card-body">
                  <div className="flex-between mb-2">
                    <h3 className="section-title">{String(selectedTicket.subject || 'Destek konuşması')}</h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedTicket(null)}>Kapat</button>
                  </div>
                  {ticketMessages.length === 0 ? <p className="small muted">Henüz mesaj yok.</p> : (
                    <div className="form-grid">
                      {ticketMessages.map((message) => (
                        <article key={message.id} className="card" style={{ padding: '0.85rem' }}>
                          <div className="flex-between"><strong>{String(message.author_name || (message.author_role === 'admin' ? 'Destek ekibi' : 'Kullanıcı'))}</strong><span className="small muted">{message.created_at ? formatDate(String(message.created_at)) : ''}</span></div>
                          <p className="mt-1" style={{ whiteSpace: 'pre-wrap' }}>{String(message.body || '')}</p>
                        </article>
                      ))}
                    </div>
                  )}
                  {selectedTicket.status !== 'closed' && (
                    <form onSubmit={sendTicketReply} className="form-grid mt-2">
                      <div className="field">
                        <label className="label" htmlFor="admin-ticket-reply">Yanıt</label>
                        <textarea id="admin-ticket-reply" className="textarea" required minLength={2} maxLength={4000} value={ticketReply} onChange={(event) => setTicketReply(event.target.value)} />
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={!ticketReply.trim()}>Yanıt gönder</button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
