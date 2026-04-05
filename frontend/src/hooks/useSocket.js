import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../context/authStore';

let socket = null;

export const useSocket = (onEvent) => {
  const { business, isAuthenticated } = useAuthStore();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!isAuthenticated || !business?.id) return;

    socket = io('/', { withCredentials: true, transports: ['websocket'] });

    socket.on('connect', () => {
      socket.emit('join_room', business.id);
    });

    const events = ['new_appointment', 'appointment_updated', 'new_message', 'whatsapp_message'];
    events.forEach((evt) => {
      socket.on(evt, (data) => onEventRef.current?.(evt, data));
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [isAuthenticated, business?.id]);

  return socket;
};

export const emitEvent = (event, data) => socket?.emit(event, data);
