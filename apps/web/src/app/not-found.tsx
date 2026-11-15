import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <div className="not-found-art" aria-hidden="true">
          <span>404</span>
          <i />
        </div>
        <div className="not-found-copy">
          <span className="not-found-kicker">USTA BUL · DOĞRU YERDESİNİZ</span>
          <h1>Bu sayfa bulunamadı.</h1>
          <p>Merak etmeyin, aradığınız güvenilir ustaya ana sayfadan ulaşabilirsiniz.</p>
          <Link href="/" className="btn btn-primary">
            Ana sayfaya dön <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
