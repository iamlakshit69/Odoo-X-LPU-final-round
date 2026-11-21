import { db } from '../../core/db/index.js';
import { settings } from '../schema/core.js';

export async function seed() {
  console.log('[Seed] Seeding core settings...');
  const defaultSettings = [
    { key: 'club.timezone', value: 'Asia/Kolkata', description: 'Club local timezone' },
    { key: 'booking.slot_minutes', value: 30, description: 'Slot start interval in minutes' },
    { key: 'booking.session_minutes', value: 60, description: 'Standard court session duration' },
    { key: 'booking.hold_minutes', value: 5, description: 'Temporary hold duration for online payments' },
    { key: 'booking.default_daily_limit', value: 2, description: 'Default max sessions per member per day' },
    { key: 'booking.advance_days', value: 14, description: 'Maximum days in advance a slot can be booked' },
    {
      key: 'booking.cancellation_policy',
      value: [
        { hours_before: 24, refund_pct: 100 },
        { hours_before: 2, refund_pct: 50 },
        { hours_before: 0, refund_pct: 0 },
      ],
      description: 'Cancellation refund percentage based on notice',
    },
    {
      key: 'social.windows',
      value: [{ weekday: 5, from: '18:00', to: '22:00', capacity: 16 }],
      description: 'Social play sessions schedule and capacity',
    },
    {
      key: 'membership.reminder_days',
      value: [30, 7],
      description: 'Days before membership expiry to send reminders',
    },
    {
      key: 'crm.stages',
      value: ['new', 'contacted', 'quotation_sent', 'follow_up', 'converted', 'lost'],
      description: 'CRM lead pipeline stages',
    },
    { key: 'inventory.default_low_stock', value: 3, description: 'Default low stock alert threshold' },
    { key: 'bar.table_occupied_minutes', value: 90, description: 'Threshold for highlighting occupied tables' },
  ];

  for (const s of defaultSettings) {
    await db.insert(settings).values(s).onConflictDoUpdate({
      target: settings.key,
      set: { value: s.value, description: s.description, updatedAt: new Date() },
    });
  }
  console.log('[Seed] Core settings seeded.');
}
