import { useEffect, useRef } from 'react';
import { API_BASE } from '../services/api';

/**
 * useRealtime hook:
 * Subscribes to Server-Sent Events from /api/realtime.
 *
 * @param {Object} options
 * @param {Function} [options.onEvent] - Callback for all received events (event, data)
 * @param {Function} [options.onSync] - Callback fired upon initial connect and re-connections for state recovery
 * @param {boolean} [options.enabled=true] - Whether the subscription is active
 */
export function useRealtime({ onEvent, onSync, enabled = true } = {}) {
  const onEventRef = useRef(onEvent);
  const onSyncRef = useRef(onSync);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  useEffect(() => {
    if (!enabled) return;

    const token = sessionStorage.getItem('token');
    if (!token || token === 'demo-token') return;

    let eventSource = null;
    let isDisposed = false;

    try {
      const sseUrl = `${API_BASE}/realtime?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        if (isDisposed) return;
        if (wasConnectedRef.current && onSyncRef.current) {
          // Re-connection after drop: trigger authoritative sync
          onSyncRef.current();
        }
        wasConnectedRef.current = true;
      };

      const handleIncoming = (type) => (e) => {
        if (isDisposed) return;
        try {
          const data = e.data ? JSON.parse(e.data) : null;
          if (onEventRef.current) {
            onEventRef.current(type, data);
          }
        } catch {
          // Non-JSON or keep-alive ping
        }
      };

      // Named event listeners
      const eventNames = [
        'connected',
        'BOOKING_CREATED',
        'BOOKING_ASSIGNED',
        'BOOKING_CLAIMED',
        'BOOKING_STATUS_CHANGED',
        'BOOKING_CANCELLED',
        'PAYMENT_UPDATED',
      ];

      eventNames.forEach((name) => {
        eventSource.addEventListener(name, handleIncoming(name));
      });

      // Default message handler
      eventSource.onmessage = handleIncoming('message');

      eventSource.onerror = () => {
        // EventSource will automatically attempt to reconnect in the background
      };
    } catch {
      // Failed to instantiate EventSource
    }

    return () => {
      isDisposed = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [enabled]);
}

export default useRealtime;
