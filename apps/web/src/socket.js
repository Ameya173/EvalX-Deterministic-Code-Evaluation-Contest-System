import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || undefined;

/** Subscribe to a socket event for as long as the component is mounted. Reconnects when the token changes. */
export function useSocketEvent(token, event, handler, { contestId } = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on(event, (payload) => ref.current(payload));
    if (contestId) socket.on('connect', () => socket.emit('contest:watch', contestId));
    return () => socket.disconnect();
  }, [token, event, contestId]);
}
