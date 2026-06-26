/**
 * Socket.IO client — connects to the Node.js unified gateway (port 4000).
 * autoConnect: false so we only connect after successful authentication.
 * withCredentials: true sends the httpOnly JWT cookie on the handshake.
 */
import { io } from 'socket.io-client';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

export const socket = io(GATEWAY_URL, {
  autoConnect: false,
  withCredentials: true,
});
