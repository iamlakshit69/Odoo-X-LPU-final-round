import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../lib/toast';

const TOPIC_QUERY_KEYS: Record<string, string[][]> = {
  'booking.changed': [['availability'], ['bookings'], ['social-sessions']],
  'order.item': [['orders'], ['kds']],
  'order.status': [['orders'], ['tabs']],
  'stock.low': [['inventory'], ['products']],
  'lead.created': [['leads'], ['crm']],
  'dashboard.tick': [['finance'], ['dashboard'], ['invoices'], ['reports']],
};

export function useSSE() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const sseUrl = isAuthenticated ? '/api/events' : '/api/public/events';
    const es = new EventSource(sseUrl, { withCredentials: true });
    eventSourceRef.current = es;

    const handleMessage = (topic: string, data?: any) => {
      const keysToInvalidate = TOPIC_QUERY_KEYS[topic];
      if (keysToInvalidate) {
        keysToInvalidate.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }

      if (topic === 'stock.low' && data?.productName) {
        showToast('warning', 'Low Stock Alert', `${data.productName} is below reorder threshold.`);
      } else if (topic === 'booking.changed') {
        // Silent query invalidation keeps court grid fresh
      }
    };

    // Generic message handler
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.topic) {
          handleMessage(payload.topic, payload.data);
        }
      } catch {
        // ignore non-json heartbeats
      }
    };

    // Specific topic listeners if emitted as event types
    Object.keys(TOPIC_QUERY_KEYS).forEach((topic) => {
      es.addEventListener(topic, (event: any) => {
        try {
          const parsed = JSON.parse(event.data);
          handleMessage(topic, parsed);
        } catch {
          handleMessage(topic);
        }
      });
    });

    es.onerror = () => {
      // EventSource reconnects automatically
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [isAuthenticated, queryClient, showToast]);
}
