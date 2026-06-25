export interface ParkingRecord {
  id: number;
  registration_number: string;
  type?: string;
  slot_id: number;
  in_time: string;
  out_time?: string;
  fee?: number;
  fee_id: number;
  receipt_path?: string;
}

export interface FeeRow {
  fee_id: number;
  vehicle_type: string;
  first_hour_charge: number;
  rest_hour_charge: number;
  created_at: string;
}

export type SortDir = 'asc' | 'desc';
