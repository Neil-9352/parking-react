export interface Slot {
  slot_id: number;
  slot_no: number;
  status: 'occupied' | 'unoccupied' | 'booked';
  registration_number?: string;
  type?: string;
  in_time?: string;
  booking_id?: number;
  booked_reg?: string;
  expected_start_time?: string;
  expected_end_time?: string;
  booked_type?: string;
}

export interface ReceiptData {
  registration_number: string;
  vehicle_type: string;
  hours_parked: number;
  fee: number;
  receipt_filename: string;
}
