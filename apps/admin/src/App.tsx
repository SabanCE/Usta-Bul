import React from 'react';

export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <header style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h2>Usta Bul - Yönetici & Operasyon Paneli</h2>
      </header>
      <main>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
            <h4>Onay Bekleyen Ustalar</h4>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e65100' }}>12</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
            <h4>Aktif Talepler</h4>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' }}>48</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
            <h4>Tamamlanan İşler</h4>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#388e3c' }}>1,240</p>
          </div>
        </div>
      </main>
    </div>
  );
}
