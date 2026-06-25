export interface SettingsData {
  slot_count: number;
  lot_name: string;
  address: string;
  layout_image?: string;
  fees: {
    '2-wheeler': { first_hour: number; next_hour: number };
    '4-wheeler': { first_hour: number; next_hour: number };
  };
}
