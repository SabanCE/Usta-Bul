'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, UserRole } from '../context/AuthContext';
import { getAuthHeaders } from '../utils/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'bid_received' | 'new_request' | 'bid_accepted' | 'bid_rejected' | 'info';
  link: string;
  createdAt: string;
  isRead?: boolean;
}

const roleLabels: Record<UserRole, string> = {
  customer: 'Müşteri',
  artisan: 'Usta',
  admin: 'Yönetici',
};

// Okundu bilgisi sunucuda saklanır; böylece sayfa yenilense de bildirim
// yeniden okunmamış (kırmızı) görünmez.
const markNotificationsRead = async (ids: string[]) => {
  if (ids.length === 0) return;
  try {
    await fetch('http://localhost:5000/api/v1/notifications/read', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids }),
    });
  } catch {
    // Sessizce yut: okuma işareti bir sonraki açılışta yeniden denenir.
  }
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/v1/notifications', {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          setNotifications([]);
          setUnreadCount(0);
          return;
        }
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setNotifications(json.data);
          const unread =
            typeof json.unreadCount === 'number'
              ? json.unreadCount
              : json.data.filter((item: NotificationItem) => !item.isRead).length;
          setUnreadCount(unread);
        }
      } catch {
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (href: string) => pathname === href;
  const isMapRoute = pathname === '/' || pathname === '/artisan-dashboard';

  return (
    <header className={`navbar${isMapRoute ? ' navbar-rota' : ''}`}>
      <div className="container nav-container">
        <Link href="/" className="logo">
          <span className="logo-mark">U</span>
          <span>Usta Bul</span>
        </Link>

        <nav className="nav-links">
          {!user && (
            <>
              <Link href="/" className={`nav-link nav-link-keep ${isActive('/') ? 'nav-link-active' : ''}`}>
                Ustalar
              </Link>
              <Link href="/#categories" className="nav-link">
                Kategoriler
              </Link>
              <Link href="/register?role=artisan" className="nav-link nav-link-keep">
                Usta Olarak Katıl
              </Link>
              <span className="nav-divider" />
              <Link href="/login" className="btn btn-secondary btn-sm">
                Giriş Yap
              </Link>
            </>
          )}

          {user && user.role === 'customer' && (
            <>
              <Link href="/" className={`nav-link ${isActive('/') ? 'nav-link-active' : ''}`}>
                Ustalar
              </Link>
              <Link href="/requests" className={`nav-link ${isActive('/requests') ? 'nav-link-active' : ''}`}>
                Taleplerim
              </Link>
              <Link href="/profile" className={`nav-link ${isActive('/profile') ? 'nav-link-active' : ''}`}>
                Profilim
              </Link>
              <Link href="/support" className={`nav-link ${isActive('/support') ? 'nav-link-active' : ''}`}>
                Destek ve yardım
              </Link>
              <span className="nav-divider" />
              <Link href="/requests/new" className="btn btn-primary btn-sm">
                Yeni Talep
              </Link>
            </>
          )}

          {user && user.role === 'artisan' && (
            <>
              <Link
                href="/artisan-dashboard"
                className={`nav-link ${isActive('/artisan-dashboard') ? 'nav-link-active' : ''}`}
              >
                İş Paneli
              </Link>
              <Link
                href="/artisan-dashboard/profile"
                className={`nav-link ${isActive('/artisan-dashboard/profile') ? 'nav-link-active' : ''}`}
              >
                Profilim
              </Link>
              <Link
                href="/support"
                className={`nav-link ${isActive('/support') ? 'nav-link-active' : ''}`}
              >
                Destek ve yardım
              </Link>
              <Link
                href={`/artisans/${user.id}`}
                className={`nav-link ${pathname.startsWith('/artisans/') ? 'nav-link-active' : ''}`}
              >
                Portföyüm
              </Link>
            </>
          )}

          {user && user.role === 'admin' && (
            <Link
              href="/admin-dashboard"
              className={`nav-link ${isActive('/admin-dashboard') ? 'nav-link-active' : ''}`}
            >
              Yönetim Paneli
            </Link>
          )}

          {user && (
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !showNotifications;
                  setShowNotifications(nextOpen);
                  if (nextOpen) {
                    // Panel açıldığında listedeki tüm bildirimleri okundu işaretle.
                    const ids = notifications.map((notification) => notification.id);
                    setUnreadCount(0);
                    setNotifications((prev) =>
                      prev.map((notification) => ({ ...notification, isRead: true }))
                    );
                    markNotificationsRead(ids);
                  }
                }}
                className="notif-button"
                aria-label="Bildirimler"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
              </button>

              {showNotifications && (
                <div className="notif-panel">
                  <div className="notif-head">
                    <span className="notif-title">Bildirimler</span>
                    <span className="small muted">{notifications.length}</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="small muted text-center" style={{ padding: '1rem 0' }}>
                      Yeni bildiriminiz yok.
                    </p>
                  ) : (
                    <div style={{ maxHeight: 280, overflowY: 'auto', display: 'grid', gap: 2 }}>
                      {notifications.map((n) => (
                        <Link
                          key={n.id}
                          href={n.link}
                          onClick={() => setShowNotifications(false)}
                          className="notif-item"
                        >
                          <div className="notif-item-title">{n.title}</div>
                          <div className="notif-item-text">{n.message}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {user && (
            <div className="nav-user">
              <span className="nav-avatar">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName || 'Profil fotoğrafı'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                    }}
                  />
                ) : (
                  user.fullName?.charAt(0) || 'U'
                )}
              </span>
              <div className="nav-user-name">
                <div>{user.fullName}</div>
                <div className="nav-user-role">{roleLabels[user.role]}</div>
              </div>
              <button type="button" onClick={logout} className="btn btn-ghost btn-sm">
                Çıkış
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
