'use client';

import React, { useState } from 'react';
import { getAuthHeaders } from '../utils/api';
import { useAuth } from '../context/AuthContext';

type ReportTarget = 'user' | 'review' | 'bid' | 'request';

const reasons = [
  ['abuse', 'Hakaret veya uygunsuz içerik'],
  ['spam', 'Spam veya yanıltıcı içerik'],
  ['fraud', 'Sahtecilik veya dolandırıcılık şüphesi'],
  ['safety', 'Güvenlik endişesi'],
  ['other', 'Diğer'],
];

export default function ReportButton({
  targetType,
  targetId,
  label = 'Şikâyet et',
}: {
  targetType: ReportTarget;
  targetId: string;
  label?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('abuse');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (
    !user ||
    (user.role !== 'customer' && user.role !== 'artisan') ||
    !targetId ||
    (targetType === 'user' && targetId === user.id)
  ) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('http://localhost:5000/api/v1/reports', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ targetType, targetId, reason, description }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || 'Şikâyet gönderilemedi.');
      setMessage({ type: 'success', text: 'Şikâyetiniz inceleme için iletildi.' });
      setDescription('');
      setOpen(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Şikâyet gönderilemedi.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setMessage(null);
          setOpen((value) => !value);
        }}
      >
        {open ? 'Vazgeç' : label}
      </button>
      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'} mt-1`}>
          {message.text}
        </div>
      )}
      {open && (
        <form onSubmit={submit} className="form-grid mt-2" style={{ maxWidth: 420 }}>
          <div className="field">
            <label className="label" htmlFor={`report-reason-${targetId}`}>Şikâyet nedeni</label>
            <select
              id={`report-reason-${targetId}`}
              className="select"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {reasons.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor={`report-description-${targetId}`}>Açıklama</label>
            <textarea
              id={`report-description-${targetId}`}
              className="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              required
              minLength={5}
              placeholder="Sorunu kısaca açıklayın"
            />
            <span className="small muted">{description.length}/2000</span>
          </div>
          <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
            {busy ? 'Gönderiliyor...' : 'Şikâyeti gönder'}
          </button>
        </form>
      )}
    </div>
  );
}
