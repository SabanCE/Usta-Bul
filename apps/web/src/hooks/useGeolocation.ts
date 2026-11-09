'use client';

import { useCallback, useState } from 'react';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

export function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const locate = useCallback((): Promise<Coordinates | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setError('Tarayıcınız konum servisini desteklemiyor.');
        resolve(null);
        return;
      }

      setLocating(true);
      setError('');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocating(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (err) => {
          setLocating(false);
          if (err.code === err.PERMISSION_DENIED) {
            setError('Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açabilirsiniz.');
          } else if (err.code === err.TIMEOUT) {
            setError('Konum alınamadı. Lütfen tekrar deneyin.');
          } else {
            setError('Konumunuz belirlenemedi. Lütfen tekrar deneyin.');
          }
          resolve(null);
        },
        GEOLOCATION_OPTIONS
      );
    });
  }, []);

  return { locate, locating, error };
}
