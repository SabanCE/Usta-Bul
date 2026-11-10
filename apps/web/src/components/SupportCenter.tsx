'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiUrl, getAuthHeaders } from '../utils/api';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  updated_at: string;
  message_count: number;
}

interface TicketMessage {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  body: string;
  created_at: string;
}

interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

interface UserReport {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string;
  status: string;
  created_at: string;
}

const statusNames: Record<string, string> = {
  open: 'Açık',
  investigating: 'İnceleniyor',
  in_progress: 'İnceleniyor',
  resolved: 'Çözüldü',
  closed: 'Kapatıldı',
  dismissed: 'Reddedildi',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportCenter() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ticketResponse, reportResponse] = await Promise.all([
        fetch(apiUrl('/api/v1/support'), {
          headers: getAuthHeaders(),
          cache: 'no-store',
        }),
        fetch(apiUrl('/api/v1/reports/me'), {
          headers: getAuthHeaders(),
          cache: 'no-store',
        }),
      ]);
      const [ticketData, reportData] = await Promise.all([
        ticketResponse.json().catch(() => null),
        reportResponse.json().catch(() => null),
      ]);
      if (!ticketResponse.ok) throw new Error(ticketData?.error?.message || 'Destek kayıtları yüklenemedi.');
      if (!reportResponse.ok) throw new Error(reportData?.error?.message || 'Şikâyet geçmişi yüklenemedi.');
      setTickets(Array.isArray(ticketData?.data) ? ticketData.data : []);
      setReports(Array.isArray(reportData?.data) ? reportData.data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Destek kayıtları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const openTicket = async (ticket: Ticket) => {
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/v1/support/${ticket.id}`), {
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Destek konuşması yüklenemedi.');
      setSelected(data.data as TicketDetail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Destek konuşması yüklenemedi.');
    }
  };

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(apiUrl('/api/v1/support'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ subject, message }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Destek talebi oluşturulamadı.');
      setSubject('');
      setMessage('');
      setNotice('Destek talebiniz oluşturuldu.');
      await loadTickets();
      if (data?.data?.id) await openTicket(data.data as Ticket);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Destek talebi oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  };

  const submitReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(apiUrl(`/api/v1/support/${selected.id}/messages`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message: reply }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Yanıt gönderilemedi.');
      setReply('');
      setNotice('Yanıtınız gönderildi.');
      await openTicket(selected);
      await loadTickets();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Yanıt gönderilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card mb-3">
      <div className="card-body">
        <div className="section-head">
          <div>
            <h2 className="section-title">Destek ve yardım</h2>
            <p className="page-subtitle">Destek talebi oluşturun, ekiple yazışmanızı ve durumunu takip edin.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void loadTickets()} disabled={loading}>
            {loading ? 'Yükleniyor...' : 'Yenile'}
          </button>
        </div>

        {error && <div className="alert alert-error mb-2" role="alert">{error}</div>}
        {notice && <div className="alert alert-success mb-2" role="status">{notice}</div>}

        <div className="form-row" style={{ alignItems: 'start' }}>
          <form onSubmit={submitTicket} className="form-grid">
            <h3 className="list-title">Yeni destek talebi</h3>
            <div className="field">
              <label className="label" htmlFor="support-subject">Konu</label>
              <input id="support-subject" className="input" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={150} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="support-message">Mesajınız</label>
              <textarea id="support-message" className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} required minLength={5} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Gönderiliyor...' : 'Destek talebi oluştur'}
            </button>
          </form>

          <div className="form-grid">
            <h3 className="list-title">Taleplerim</h3>
            {loading ? (
              <div className="loading-text">Destek kayıtları yükleniyor...</div>
            ) : tickets.length === 0 ? (
              <div className="empty-state" style={{ padding: '1rem' }}>
                <p>Henüz destek talebiniz yok.</p>
              </div>
            ) : (
              <div className="list">
                {tickets.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    className="card"
                    onClick={() => void openTicket(ticket)}
                    style={{ textAlign: 'left', padding: '0.85rem', borderColor: selected?.id === ticket.id ? 'var(--accent)' : undefined }}
                  >
                    <strong>{ticket.subject}</strong>
                    <div className="flex-between mt-1">
                      <span className="badge badge-neutral">{statusNames[ticket.status] || ticket.status}</span>
                      <span className="small muted">{ticket.message_count} mesaj · {formatDate(ticket.updated_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h3 className="list-title mb-1">Şikâyet geçmişim</h3>
          {loading ? (
            <div className="loading-text">Şikâyetler yükleniyor...</div>
          ) : reports.length === 0 ? (
            <p className="small muted">Henüz şikâyet göndermediniz. İçeriklerdeki “Şikâyet et” seçeneğini kullanabilirsiniz.</p>
          ) : (
            <div className="list">
              {reports.map((report) => (
                <article key={report.id} className="card" style={{ padding: '0.85rem' }}>
                  <div className="flex-between" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                    <strong>{report.reason} · {report.target_type}</strong>
                    <span className="badge badge-neutral">{statusNames[report.status] || report.status}</span>
                  </div>
                  <p className="small mt-1" style={{ whiteSpace: 'pre-wrap' }}>{report.description}</p>
                  <span className="small muted">{formatDate(report.created_at)}</span>
                </article>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="card mt-3">
            <div className="card-body">
              <div className="flex-between mb-2">
                <div>
                  <h3 className="list-title">{selected.subject}</h3>
                  <span className="badge badge-neutral">{statusNames[selected.status] || selected.status}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Kapat</button>
              </div>
              <div className="form-grid">
                {selected.messages.map((entry) => (
                  <article key={entry.id} className="card" style={{ padding: '0.9rem', background: entry.author_role === 'admin' ? 'var(--accent-soft)' : 'var(--surface)' }}>
                    <div className="flex-between">
                      <strong>{entry.author_role === 'admin' ? 'Destek ekibi' : 'Siz'}</strong>
                      <span className="small muted">{formatDate(entry.created_at)}</span>
                    </div>
                    <p className="mt-1" style={{ whiteSpace: 'pre-wrap' }}>{entry.body}</p>
                  </article>
                ))}
              </div>
              {selected.status !== 'closed' && (
                <form onSubmit={submitReply} className="form-grid mt-2">
                  <div className="field">
                    <label className="label" htmlFor="support-reply">Yanıtınız</label>
                    <textarea id="support-reply" className="textarea" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={4000} required minLength={2} />
                  </div>
                  <button type="submit" className="btn btn-secondary" disabled={busy}>
                    {busy ? 'Gönderiliyor...' : 'Yanıt gönder'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
