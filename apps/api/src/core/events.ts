import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Topic, SessionUser, Events as EventsInterface } from '@club/contract';
import { can } from './rbac.js';
import { optionalAuth } from './auth.js';
import { randomUUID } from 'node:crypto';

export interface SseClient {
  id: string;
  rawRes: any;
  user?: SessionUser;
  isPublic: boolean;
}

export class EventsService implements EventsInterface {
  private clients = new Map<string, SseClient>();

  /**
   * Adds an active SSE client connection.
   */
  addClient(client: SseClient): void {
    this.clients.set(client.id, client);
  }

  /**
   * Removes an SSE client on disconnect.
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Checks whether a client is authorized to receive a specific topic.
   */
  canReceive(client: SseClient, topic: Topic): boolean {
    // Public grid stream only receives booking.changed
    if (client.isPublic) {
      return topic === 'booking.changed';
    }

    if (!client.user) {
      return false;
    }

    // Owner receives all topics
    if (client.user.roleCode === 'owner') {
      return true;
    }

    switch (topic) {
      case 'booking.changed':
        return true; // Any authenticated user can receive booking grid changes

      case 'order.item':
        // Kitchen, bar, or staff with KDS / tab permissions
        return (
          ['kitchen', 'bartender', 'manager'].includes(client.user.roleCode) ||
          can(client.user, 'kds:read') ||
          can(client.user, 'tab:read')
        );

      case 'order.status':
        return (
          ['shop_clerk', 'manager', 'cashier'].includes(client.user.roleCode) ||
          can(client.user, 'order:read')
        );

      case 'stock.low':
        return (
          ['shop_clerk', 'manager'].includes(client.user.roleCode) ||
          can(client.user, 'stock:read')
        );

      case 'lead.created':
        return (
          ['front_desk', 'manager'].includes(client.user.roleCode) ||
          can(client.user, 'lead:read')
        );

      case 'dashboard.tick':
        return (
          ['manager', 'finance'].includes(client.user.roleCode) ||
          can(client.user, 'finance:read')
        );

      default:
        return false;
    }
  }

  /**
   * Publishes an event to all connected clients that have permission to receive it.
   */
  publish(topic: Topic, payload: Record<string, unknown>): void {
    const message = `event: ${topic}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (this.canReceive(client, topic)) {
          client.rawRes.write(message);
        }
      } catch (err) {
        console.error(`[Events] Failed to send to client ${clientId}:`, err);
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Number of active connected clients.
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Clears all clients (used for testing or clean shutdown).
   */
  clear(): void {
    this.clients.clear();
  }
}

// Global injectable singleton
export let Events: EventsService = new EventsService();

export function setEvents(impl: EventsService): void {
  Events = impl;
}

/**
 * Registers SSE endpoints:
 * - GET /events (authenticated)
 * - GET /public/events (public, limited to booking.changed)
 */
export async function registerEventRoutes(app: FastifyInstance) {
  // 1. GET /events (Authenticated)
  app.get('/events', { preHandler: [optionalAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser | undefined;
    if (!user) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required for /events stream',
        },
      });
    }

    const clientId = randomUUID();

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    reply.raw.write(': connected\n\n');

    const client: SseClient = {
      id: clientId,
      rawRes: reply.raw,
      user,
      isPublic: false,
    };

    Events.addClient(client);

    // 25-second heartbeat
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        Events.removeClient(clientId);
      }
    }, 25000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      Events.removeClient(clientId);
    });
  });

  // 2. GET /public/events (Public grid only)
  app.get('/public/events', async (req: FastifyRequest, reply: FastifyReply) => {
    const clientId = randomUUID();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    reply.raw.write(': connected\n\n');

    const client: SseClient = {
      id: clientId,
      rawRes: reply.raw,
      isPublic: true,
    };

    Events.addClient(client);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        Events.removeClient(clientId);
      }
    }, 25000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      Events.removeClient(clientId);
    });
  });
}
