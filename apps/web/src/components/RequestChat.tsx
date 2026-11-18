'use client';

import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl, getAuthHeaders } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ReportButton from './ReportButton';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

interface RequestChatData {
  status: 'open' | 'ended';
  requestStatus: string;
  otherUser: {
    id: string;
    fullName: string;
  };
  messages: ChatMessage[];
}

export default function RequestChat({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const [chat, setChat] = useState<RequestChatData | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fetching = useRef(false);
  const fetchSequence = useRef(0);
  const endOfMessages = useRef<HTMLDivElement | null>(null);

  const fetchChat = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const sequence = ++fetchSequence.current;
    try {
      const response = await fetch(apiUrl(`/api/v1/chats/requests/${requestId}`), {
        cache: 'no-store',
        headers: getAuthHeaders(),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || 'Sohbet yüklenemedi.');
      }
      if (sequence !== fetchSequence.current) return;
      setChat(body.data as RequestChatData);
      setError('');
    } catch (fetchError) {
      if (sequence === fetchSequence.current) {
        setError(fetchError instanceof Error ? fetchError.message : 'Sohbet yüklenemedi.');
      }
    } finally {
      if (sequence === fetchSequence.current) {
        setLoading(false);
        fetching.current = false;
      }
    }
  }, [requestId]);

  useEffect(() => {
    void fetchChat();
    const interval = window.setInterval(() => void fetchChat(), 5000);
    return () => {
      window.clearInterval(interval);
      fetchSequence.current += 1;
      fetching.current = false;
    };
  }, [fetchChat]);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat?.messages.length]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = message.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        apiUrl(`/api/v1/chats/requests/${requestId}/messages`),
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ body }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Mesaj gönderilemedi.');
      }
      setMessage('');
      await fetchChat();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Mesaj gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndChat = async () => {
    if (
      ending ||
      !window.confirm('Sohbeti iki taraf için de sonlandırmak istiyor musunuz? Bu işlem geri alınamaz.')
    ) return;
    setEnding(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        apiUrl(`/api/v1/chats/requests/${requestId}/end`),
        { method: 'POST', headers: getAuthHeaders() }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || 'Sohbet sonlandırılamadı.');
      }
      setChat((current) => current ? { ...current, status: 'ended' } : current);
      setNotice('Sohbet iki taraf için de sonlandırıldı.');
    } catch (endError) {
      setError(endError instanceof Error ? endError.message : 'Sohbet sonlandırılamadı.');
    } finally {
      setEnding(false);
    }
  };

  const chatIsOpen = chat?.status === 'open' && chat.requestStatus !== 'cancelled';

  return (
    <section className="request-chat card" aria-label="İş sohbeti">
      <div className="request-chat-header">
        <div>
          <span className="eyebrow">KABUL EDİLEN TEKLİF</span>
          <h2 className="section-title">
            {chat?.otherUser.fullName
              ? `${chat.otherUser.fullName} ile sohbet`
              : 'İş sohbeti'}
          </h2>
        </div>
        {chat?.otherUser && (
          <ReportButton
            targetType="user"
            targetId={chat.otherUser.id}
            label="Kullanıcıyı şikâyet et"
          />
        )}
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <div className="request-chat-messages" aria-live="polite">
        {loading ? (
          <p className="muted small">Mesajlar yükleniyor...</p>
        ) : chat?.messages.length ? (
          chat.messages.map((item) => {
            const isOwnMessage = item.sender_id === user?.id;
            return (
              <article
                key={item.id}
                className={`request-chat-message${isOwnMessage ? ' request-chat-message-own' : ''}`}
              >
                <div className="request-chat-message-meta">
                  <strong>{isOwnMessage ? 'Siz' : item.sender_name}</strong>
                  <time dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p>{item.body}</p>
              </article>
            );
          })
        ) : (
          <p className="muted small">Henüz mesaj yok. Sohbeti buradan başlatabilirsiniz.</p>
        )}
        <div ref={endOfMessages} />
      </div>

      {chatIsOpen ? (
        <>
          <form className="request-chat-compose" onSubmit={handleSend}>
            <label className="sr-only" htmlFor={`request-chat-message-${requestId}`}>
              Mesajınız
            </label>
            <textarea
              id={`request-chat-message-${requestId}`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={4000}
              rows={2}
              placeholder="Mesajınızı yazın..."
              required
            />
            <button type="submit" className="btn btn-primary" disabled={submitting || !message.trim()}>
              {submitting ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-ghost btn-sm request-chat-end"
            onClick={() => void handleEndChat()}
            disabled={ending}
          >
            {ending ? 'Sonlandırılıyor...' : 'Sohbeti sonlandır'}
          </button>
        </>
      ) : chat ? (
        <p className="request-chat-closed" role="status">
          Bu sohbet sonlandırıldı. Artık yeni mesaj gönderilemez.
        </p>
      ) : null}
    </section>
  );
}
