import {io} from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const url = new URL(BACKEND_URL);

const socket = io(url.origin,{
    autoConnect: true,
    reconnection: true
});

export default socket;