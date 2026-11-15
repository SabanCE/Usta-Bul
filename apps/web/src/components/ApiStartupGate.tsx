'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import applianceIcon from '../assets/trades/appliance.png';
import carpenterIcon from '../assets/trades/carpenter.png';
import electricianIcon from '../assets/trades/electrician.png';
import locksmithIcon from '../assets/trades/locksmith.png';
import painterIcon from '../assets/trades/painter.png';
import plumberIcon from '../assets/trades/plumber.png';
import renovationIcon from '../assets/trades/renovation.png';
import { apiUrl } from '../utils/api';

const WELCOME_SEEN_KEY = 'usta-bul-welcome-seen';

interface ApiStartupGateProps {
  children: ReactNode;
}

const categories = [
  { label: 'Tesisat', image: plumberIcon },
  { label: 'Elektrik', image: electricianIcon },
  { label: 'Boya', image: painterIcon },
  { label: 'Marangoz', image: carpenterIcon },
  { label: 'Çilingir', image: locksmithIcon },
  { label: 'Beyaz eşya', image: applianceIcon },
  { label: 'Tadilat', image: renovationIcon },
];

const guideSteps = [
  { title: 'Kategorini seç', text: 'İhtiyacına uygun hizmeti bul.' },
  { title: 'İşini anlat', text: 'Talebini birkaç adımda oluştur.' },
  { title: 'Teklifleri karşılaştır', text: 'Sana uygun ustayla anlaş.' },
];

export default function ApiStartupGate({ children }: ApiStartupGateProps) {
  const [isReady, setIsReady] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [activeGuideStep, setActiveGuideStep] = useState(0);

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
            setShowWelcome(window.localStorage.getItem(WELCOME_SEEN_KEY) !== 'true');
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

  useEffect(() => {
    if (isReady && !showWelcome) return;
    const timer = setInterval(() => {
      setActiveGuideStep((step) => (step + 1) % guideSteps.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [isReady, showWelcome]);

  if (isReady && !showWelcome) return <>{children}</>;

  return (
    <div className="startup-splash">
      <div className="startup-splash-orb startup-splash-orb-one" aria-hidden="true" />
      <div className="startup-splash-orb startup-splash-orb-two" aria-hidden="true" />
      <main className="startup-splash-content">
        <header className="startup-splash-header">
          <div className="startup-logo" aria-label="Usta Bul">
            <div className="startup-logo-mark" aria-hidden="true">
              <span>U</span>
              <i />
            </div>
            <span className="startup-logo-name">Usta Bul</span>
          </div>
          <div
            className={`startup-connection${isReady ? ' is-ready' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span />
            {isReady ? 'Sunucu hazır' : 'Sunucu başlatılıyor…'}
          </div>
        </header>

        <section className="startup-splash-hero" aria-labelledby="startup-title">
          <div className="startup-splash-copy">
            <span className="startup-splash-kicker">GÜVENİLİR USTA, KOLAY HİZMET</span>
            <h1 id="startup-title">
              Ev işleriniz için <em>doğru usta</em> bir adım yakınınızda.
            </h1>
            <p>
              İhtiyacınızı seçin, talebinizi oluşturun ve size uygun teklifleri kolayca karşılaştırın.
            </p>
          </div>
          <div className="startup-category-grid" aria-label="Hizmet kategorileri">
            {categories.map((category) => (
              <div className="startup-category-card" key={category.label}>
                <Image
                  src={category.image}
                  alt=""
                  width={42}
                  height={42}
                  priority={category.label === 'Tesisat'}
                />
                <span>{category.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="startup-guide" aria-label="Usta Bul kullanım rehberi">
          <div className="startup-guide-heading">
            <span className="startup-splash-kicker">3 KOLAY ADIM</span>
            <h2>Nasıl çalışır?</h2>
          </div>
          <div className="startup-guide-steps">
            {guideSteps.map((step, index) => (
              <article
                className={`startup-guide-step${activeGuideStep === index ? ' is-active' : ''}`}
                key={step.title}
              >
                <span className="startup-guide-number">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="startup-splash-bottom">
          <div className="startup-progress" aria-hidden="true">
            <span />
          </div>
          <p className="startup-caption">
            {isReady
              ? 'Usta Bul hazır. Hemen keşfetmeye başlayın.'
              : 'İlk açılışta sunucunun hazırlanması birkaç saniye sürebilir.'}
          </p>
          {isReady && showWelcome && (
            <button
              type="button"
              className="startup-start-button"
              onClick={() => {
                window.localStorage.setItem(WELCOME_SEEN_KEY, 'true');
                setShowWelcome(false);
              }}
            >
              Hadi başlayalım <span aria-hidden="true">→</span>
            </button>
          )}
        </footer>

        {showRetry && (
          <div className="startup-retry">
            <p>Bağlantı henüz kurulamadı. Biraz bekleyin veya sunucuya yeniden bağlanın.</p>
            <button
              type="button"
              onClick={() => {
                setShowRetry(false);
                setRetryKey((current) => current + 1);
              }}
            >
              Tekrar dene
            </button>
          </div>
        )}
      </main>
      <div className="startup-splash-footer" aria-hidden="true">
        <span>U</span> USTALAR YAKININIZDA
      </div>
    </div>
  );
}
