import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';

const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isNativeApp = Capacitor.isNativePlatform() || window.location.protocol === 'capacitor:' || host === 'localhost';
    if (isNativeApp) {
      return 'https://colectivo.fimchile.cl';
    }
    return `http://${host}:3011`;
  }
  return 'https://colectivo.fimchile.cl';
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
