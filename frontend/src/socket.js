import { io } from 'socket.io-client';
import { apiBaseUrl } from './config';

const socket = io(apiBaseUrl, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export default socket;
