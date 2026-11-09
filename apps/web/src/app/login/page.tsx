'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);

  useEffect(() => {
    setSessionEnded(new URLSearchParams(window.location.search).get('session') === 'ended');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="auth-title">Giriş yap</h1>
          <p className="auth-subtitle">Hesabınıza giriş yaparak devam edin.</p>
        </div>

        {sessionEnded && (
          <div className="alert alert-warning mb-2">
            Oturumunuz sonlandırıldı. Devam etmek için yeniden giriş yapın.
          </div>
        )}
        {errorMsg && <div className="alert alert-error mb-2">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="field">
            <label className="label" htmlFor="email">E-posta</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="ornek@ustabul.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="flex-between">
              <label className="label" htmlFor="password">Şifre</label>
              <span className="small muted">Şifremi unuttum</span>
            </div>
            <input
              id="password"
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg">
            {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
          </button>
        </form>

        <div className="auth-footer">
          Hesabınız yok mu? <Link href="/register">Kayıt olun</Link>
        </div>
      </div>
    </div>
  );
}
