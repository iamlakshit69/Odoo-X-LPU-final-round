import { db } from './db/index.js';
import { settings } from '../db/schema/core.js';
import { eq } from 'drizzle-orm';
import { settingsMapSchema } from '@club/contract';

// Default settings per Section 5.9
export const DEFAULT_SETTINGS: Record<string, unknown> = {
  'club.timezone': 'Asia/Kolkata',
  'booking.slot_minutes': 30,
  'booking.session_minutes': 60,
  'booking.hold_minutes': 5,
  'booking.default_daily_limit': 2,
  'booking.advance_days': 14,
  'booking.cancellation_policy': [
    { hours_before: 24, refund_pct: 100 },
    { hours_before: 2, refund_pct: 50 },
    { hours_before: 0, refund_pct: 0 },
  ],
  'booking.social_counts_toward_limit': false,
  'social.windows': [{ weekday: 5, from: '18:00', to: '22:00', capacity: 16 }],
  'membership.reminder_days': [30, 7],
  'crm.stages': ['new', 'contacted', 'quotation_sent', 'follow_up', 'converted', 'lost'],
  'inventory.default_low_stock': 3,
  'bar.table_occupied_minutes': 90,
};

// In-process cache for settings
const settingsCache = new Map<string, unknown>();

export class SettingsService {
  /**
   * Retrieves a setting value by key. Uses in-memory cache with DB fallback.
   */
  async get<T>(key: string): Promise<T> {
    if (settingsCache.has(key)) {
      return settingsCache.get(key) as T;
    }

    try {
      const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
      if (rows.length > 0 && rows[0].value !== undefined) {
        settingsCache.set(key, rows[0].value);
        return rows[0].value as T;
      }
    } catch {
      // Fallback to default if DB is offline
    }

    const defaultValue = DEFAULT_SETTINGS[key];
    if (defaultValue !== undefined) {
      settingsCache.set(key, defaultValue);
      return defaultValue as T;
    }

    return undefined as unknown as T;
  }

  /**
   * Updates a setting value, validating it and invalidating cache.
   */
  async set(key: string, value: unknown, updatedBy?: string): Promise<void> {
    // Validate value against settings schema if present
    const keySchema = (settingsMapSchema.shape as any)[key];
    if (keySchema) {
      value = keySchema.parse(value);
    }

    await db
      .insert(settings)
      .values({
        key,
        value,
        updatedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value,
          updatedBy,
          updatedAt: new Date(),
        },
      });

    // Invalidate and update cache
    settingsCache.set(key, value);
  }

  /**
   * Clears the in-memory settings cache.
   */
  clearCache(): void {
    settingsCache.clear();
  }
}

export const Settings = new SettingsService();
