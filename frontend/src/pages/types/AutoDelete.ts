export interface RemoveResult {
  status: 'removed' | 'no_match';
  plate: string;
  type?: string;
  slot?: number;
  duration_hours?: number;
  charge?: number;
  receipt_filename?: string;
  booking_id?: number;
  booking_amount?: number;
  refund_status?: string;
  message?: string;
}
