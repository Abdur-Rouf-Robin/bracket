'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { REALTIME_EVENTS } from '@bracket/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
const INVALIDATE_DEBOUNCE_MS = 400;

let socket: Socket | null = null;

function getSocket() {
  if (!socket) {
    socket = io(WS_URL, { autoConnect: true, transports: ['websocket'] });
  }
  return socket;
}

export function useTournamentLive(
  tournamentId: string | undefined,
  slug?: string,
) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tournamentId) return;
    const s = getSocket();

    const onConnect = () => {
      setConnected(true);
      s.emit('tournament:join', { tournamentId });
    };
    const onDisconnect = () => setConnected(false);

    if (s.connected) onConnect();
    else s.connect();

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (slug) {
          void qc.invalidateQueries({ queryKey: ['tournament', slug] });
          void qc.invalidateQueries({ queryKey: ['tournament-mvp', slug] });
        }
        void qc.invalidateQueries({ queryKey: ['tournament-id', tournamentId] });
      }, INVALIDATE_DEBOUNCE_MS);
    };

    s.on(REALTIME_EVENTS.BRACKET_UPDATED, invalidate);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      s.emit('tournament:leave', { tournamentId });
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off(REALTIME_EVENTS.BRACKET_UPDATED, invalidate);
    };
  }, [tournamentId, slug, qc]);

  return { connected };
}
