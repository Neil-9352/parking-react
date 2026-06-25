export interface Step1 {
  lot_name: string;
  address: string;
  total_slots: string;
  fee_2w_first: string;
  fee_2w_next: string;
  fee_4w_first: string;
  fee_4w_next: string;
  layout_image: File | null;
}

export interface Step2 {
  username: string;
  password: string;
  confirm_password: string;
}

export type Step1Errors = Partial<Record<keyof Step1, string>>;
export type Step2Errors = Partial<Record<keyof Step2, string>>;
