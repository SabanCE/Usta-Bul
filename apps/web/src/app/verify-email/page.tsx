'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiUrl } from '../../utils/api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const initialEmail = searchParams.get('email') || '';
  const deliveryFailed = searchParams.get('delivery') === 'retry';
  const alreadyVerified = searchParams.get('verified') === '1';
  const [email, setEmail] = useState(initialEmail);
  const [verifying, setVerifying] = useState(Boolean(token));
  const [sending, setSending] = useState(false);
  const [verified, setVerified] = useState(alreadyVerified);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || alreadyVerified) return;
    let active = true;

    const verify = async () => {
      setVerifying(true);
      setError('');
      try {
        const response = await fetch(apiUrl('/api/v1/auth/verify-email'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.error?.message || 'E-posta doğrulanamadı.');
        }
        if (active) {
          setVerified(true);
          router.replace('/verify-email?verified=1');
        }
      } catch (verificationError) {
        if (active) {
          setError(
            verificationError instanceof Error
              ? verificationError.message
              : 'E-posta doğrulanamadı. Yeni bir bağlantı isteyin.'
          );
        }
      } finally {
        if (active) setVerifying(false);
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [alreadyVerified, router, token]);

  const resendVerification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(apiUrl('/api/v1/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || 'E-posta gönderilemedi.');
      }
      if (body?.data?.sent === true) {
        setMessage(
          'E-posta sunucumuz mesajı kabul etti. Teslimat birkaç dakika sürebilir; spam klasörünü de kontrol edin.'
        );
      } else {
        setMessage(
          'Şu anda yeni e-posta gönderilmedi. Adresin doğrulanmamış bir hesaba ait olduğundan emin olun; az önce denediyseniz 1 dakika sonra tekrar deneyin.'
        );
      }
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : 'E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="auth-card email-verification-card">
        <div className="email-verification-icon" aria-hidden="true">
          {verified ? '✓' : '✉'}
        </div>
        <h1 className="auth-title">
          {verifying
            ? 'E-posta doğrulanıyor'
            : verified
              ? 'E-posta doğrulandı'
              : 'E-postanızı doğrulayın'}
        </h1>
        <p className="auth-subtitle">
          {verifying
            ? 'Bağlantınız kontrol ediliyor, lütfen bekleyin.'
            : verified
              ? 'Hesabınız hazır. Giriş yaparak Usta Bul’ı kullanmaya başlayabilirsiniz.'
              : deliveryFailed
                ? 'Hesabınız oluşturuldu ancak e-posta gönderilemedi. SMTP ayarları tamamlandığında yeni bağlantı isteyebilirsiniz.'
                : 'Hesabınızı etkinleştirmek için e-posta adresinize gönderdiğimiz bağlantıya tıklayın. E-posta birkaç dakika içinde gelmezse spam klasörünü kontrol edin.'}
        </p>

        {error && <div className="alert alert-error mb-2" role="alert">{error}</div>}
        {message && <div className="alert alert-success mb-2" role="status">{message}</div>}

        {verified ? (
          <Link href="/login" className="btn btn-primary btn-block mt-3">
            Giriş yap
          </Link>
        ) : !verifying ? (
          <>
            <form className="email-verification-resend" onSubmit={resendVerification}>
              <label className="field">
                <span className="label">E-posta adresi</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ornek@ustabul.com"
                />
              </label>
              <button type="submit" className="btn btn-secondary btn-block" disabled={sending}>
                {sending ? 'Gönderiliyor...' : 'Doğrulama e-postasını yeniden gönder'}
              </button>
            </form>
            <div className="auth-footer">
              E-postanızı doğruladıktan sonra <Link href="/login">giriş yapın</Link>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="loading-text">E-posta doğrulama sayfası yükleniyor...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
