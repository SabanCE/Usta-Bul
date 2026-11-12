'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { apiUrl } from '../utils/api';

interface ApiStartupGateProps {
  children: ReactNode;
}

export default function ApiStartupGate({ children }: ApiStartupGateProps) {
  const [isReady, setIsReady] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let requestController: AbortController | undefined;

    const checkApi = async () => {
      requestController = new AbortController();
      const requestTimeout = setTimeout(() => requestController?.abort(), 15000);

      try {
        const response = await fetch(apiUrl('/health'), {
          cache: 'no-store',
          signal: requestController.signal,
        });
        if (response.ok) {
          const health = await response.json();
          if (health?.status === 'ok' && active) {
            setIsReady(true);
            return;
          }
        }
      } catch {
        // API is still starting or temporarily unreachable; the splash retries automatically.
      } finally {
        clearTimeout(requestTimeout);
      }

      if (!active) return;
      const delay = Math.min(2000 * 2 ** attempt, 12000);
      attempt += 1;
      retryTimer = setTimeout(checkApi, delay);
    };

    void checkApi();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      requestController?.abort();
    };
  }, [retryKey]);

  useEffect(() => {
    if (isReady) return;
    const timer = setTimeout(() => setShowRetry(true), 18000);
    return () => clearTimeout(timer);
  }, [isReady, retryKey]);

  if (isReady) return <>{children}</>;

  return (
    <div className="startup-splash" role="status" aria-live="polite">
      <div className="startup-splash-orb startup-splash-orb-one" aria-hidden="true" />
      <div className="startup-splash-orb startup-splash-orb-two" aria-hidden="true" />
      <div className="startup-splash-content">
        <div className="startup-logo" aria-label="Usta Bul">
          <div className="startup-logo-mark" aria-hidden="true">
            <span>U</span>
            <i />
          </div>
          <span className="startup-logo-name">Usta Bul</span>
        </div>

        <div className="startup-animation" aria-hidden="true">
          <span className="startup-animation-ring" />
          <span className="startup-animation-dot startup-animation-dot-one" />
          <span className="startup-animation-dot startup-animation-dot-two" />
          <span className="startup-animation-dot startup-animation-dot-three" />
          <span className="startup-animation-center">U</span>
        </div>

        <h1 className="startup-title">Birazdan buradayız</h1>
        <p className="startup-message">
          Sunucu başlatılıyor, bu işlem ilk açılışta biraz sürebilir…
        </p>
        <div className="startup-progress" aria-hidden="true">
          <span />
        </div>
        <p className="startup-caption">Usta Bul sizin için hazırlanıyor</p>

        {showRetry && (
          <div className="startup-retry">
            <p>Bağlantı henüz kurulamadı. Sunucuya yeniden bağlanmayı deneyebilirsiniz.</p>
            <button type="button" onClick={() => {
              setShowRetry(false);
              setRetryKey((current) => current + 1);
            }}>
              Tekrar dene
            </button>
          </div>
        )}
      </div>
      <div className="startup-splash-footer" aria-hidden="true">
        <span>U</span> USTALAR YAKININIZDA
      </div>
    </div>
  );
}
