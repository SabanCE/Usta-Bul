'use client';

import React, { useEffect, useState } from 'react';
import applianceIcon from '../assets/trades/appliance.png';
import carpenterIcon from '../assets/trades/carpenter.png';
import electricianIcon from '../assets/trades/electrician.png';
import locksmithIcon from '../assets/trades/locksmith.png';
import painterIcon from '../assets/trades/painter.png';
import plumberIcon from '../assets/trades/plumber.png';
import renovationIcon from '../assets/trades/renovation.png';
import tradespersonIcon from '../assets/trades/tradesperson.png';

const categoryIcons: Record<string, string> = {
  appliance: applianceIcon.src,
  carpenter: carpenterIcon.src,
  electrician: electricianIcon.src,
  locksmith: locksmithIcon.src,
  painter: painterIcon.src,
  plumber: plumberIcon.src,
  renovation: renovationIcon.src,
};

interface ArtisanAvatarProps {
  src?: string | null;
  name: string;
  category?: string | null;
  className: string;
  showTradeIcon?: boolean;
}

export default function ArtisanAvatar({
  src,
  name,
  category,
  className,
  showTradeIcon = true,
}: ArtisanAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const normalizedCategory = category?.trim().toLowerCase();
  const fallbackImage = (normalizedCategory && categoryIcons[normalizedCategory]) ||
    (showTradeIcon ? tradespersonIcon.src : null);
  const imageSource = src && !imageFailed ? src : fallbackImage;

  if (!imageSource) {
    return (
      <span className={`${className} avatar-initial`} aria-label={name}>
        {name.charAt(0) || 'U'}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={imageSource}
      alt={src && !imageFailed ? `${name} profil fotoğrafı` : `${name} için hizmet simgesi`}
      style={{ objectFit: 'cover' }}
      onError={() => {
        if (src && !imageFailed) setImageFailed(true);
      }}
    />
  );
}
