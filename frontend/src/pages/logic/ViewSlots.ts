import type { Slot } from '../types/ViewSlots';

/** Derives the canonical display status for a slot card. */
export function getDisplayStatus(slot: Slot): 'occupied' | 'booked' | 'unoccupied' {
  if (slot.status === 'occupied') return 'occupied';
  if (slot.booking_id) return 'booked';
  return 'unoccupied';
}

/** Returns the Tailwind border+background classes for a slot card based on its status. */
export function slotColors(status: string): string {
  switch (status) {
    case 'occupied':
      return 'border-red-300 bg-red-50';
    case 'booked':
      return 'border-amber-300 bg-amber-50';
    default:
      return 'border-emerald-300 bg-emerald-50';
  }
}

/** Returns the emoji icon to display inside a slot card. */
export function slotIcon(slot: Slot, displayStatus: string): string {
  if (displayStatus === 'occupied')
    return slot.type === '2-wheeler' ? '🏍️' : '🚗';
  if (displayStatus === 'booked')
    return slot.booked_type === '2-wheeler' ? '🏍️' : '🚗';
  return '🅿️';
}

/**
 * Formats a datetime string for display in slot cards.
 * Returns '—' for missing/undefined values.
 */
export function formatSlotDateTime(dt?: string): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
