export interface Booking {
  booking_id: number;
  registration_number: string;
  vehicle_type?: string;
  slot_no: number;
  expected_start_time: string;
  expected_end_time: string;
  booking_status: 'ACTIVE' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  booking_amount: number;
  refund_status: 'PENDING' | 'REFUNDED' | 'NOT_APPLICABLE';
  refund_percentage?: number;
  refund_amount?: number;
  cancellation_time?: string;
  user_name?: string;
  user_phone?: string;
}

export type BookingStatus = Booking['booking_status'] | 'ALL';
