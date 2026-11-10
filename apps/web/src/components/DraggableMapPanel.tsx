'use client';

import React, { PointerEvent, ReactNode, useRef, useState } from 'react';

interface DraggableMapPanelProps {
  children: ReactNode;
  className?: string;
  ariaLabel: string;
}

interface DragState {
  pointerId: number;
  startY: number;
  startHeight: number;
}

export default function DraggableMapPanel({
  children,
  className,
  ariaLabel,
}: DraggableMapPanelProps) {
  const [heightRatio, setHeightRatio] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    const panel = event.currentTarget.parentElement;
    if (!panel) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: panel.getBoundingClientRect().height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = drag.startY - event.clientY;
    const minHeight = Math.min(220, window.innerHeight * 0.3);
    const maxHeight = window.innerHeight * 0.82;
    setHeightRatio(
      Math.min(maxHeight, Math.max(minHeight, drag.startHeight + delta)) / window.innerHeight
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const panel = event.currentTarget.parentElement;
    const currentHeight = heightRatio === null
      ? panel?.getBoundingClientRect().height ?? 0
      : heightRatio * window.innerHeight;
    const change = event.key === 'ArrowUp' ? 80 : -80;
    setHeightRatio(
      Math.min(
        window.innerHeight * 0.82,
        Math.max(Math.min(220, window.innerHeight * 0.3), currentHeight + change)
      ) / window.innerHeight
    );
  };

  return (
    <aside className={className} style={heightRatio === null ? undefined : { height: `${heightRatio * 100}dvh` }}>
      <div
        className="rota-panel-drag-handle"
        role="separator"
        aria-label={`${ariaLabel} panelini yukarı veya aşağı sürükleyin`}
        aria-orientation="horizontal"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <span />
      </div>
      {children}
    </aside>
  );
}
