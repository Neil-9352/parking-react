export interface EntryResult {
  plate: string;
  type: string;
  slot: number;
  entry_type: string;
  early_walkin: boolean;
  booking_id?: number;
  cancelled_booking_id?: number;
  refund_amount?: number;
  displaced_booking_id?: number;
}
