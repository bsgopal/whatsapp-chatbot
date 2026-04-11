import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../context/authStore';

let socket = null;

export const useSocket = (onEvent) => {
  const { business, isAuthenticated } = useAuthStore();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // business.id comes from serializeBusinessForAuth (auth login/register/me)
  // but updateBusiness() (called after Settings save) passes a raw Mongoose doc
  // which has _id but NOT id — so we fall back to _id to keep the room consistent
  const businessId = business?.id || business?._id;

  useEffect(() => {
    if (!isAuthenticated || !businessId) return;

    socket = io('/', { withCredentials: true, transports: ['websocket'] });

    socket.on('connect', () => {
      socket.emit('join_room', String(businessId));
    });

    const events = ['new_appointment', 'appointment_updated', 'new_message', 'whatsapp_message'];
    events.forEach((evt) => {
      socket.on(evt, (data) => onEventRef.current?.(evt, data));
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [isAuthenticated, businessId]);

  return socket;
};

export const emitEvent = (event, data) => socket?.emit(event, data);