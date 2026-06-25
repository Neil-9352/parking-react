import type { Step1, Step2, Step1Errors, Step2Errors } from '../types/Register';

/**
 * Validates Step 1 (lot details) and returns a map of field → error message.
 * An empty object means validation passed.
 */
export function validateStep1(s1: Step1): Step1Errors {
  const errs: Step1Errors = {};

  if (!s1.lot_name.trim()) errs.lot_name = 'Parking lot name is required.';
  else if (s1.lot_name.length > 100) errs.lot_name = 'Max 100 characters.';

  if (!s1.address.trim()) errs.address = 'Address is required.';
  else if (s1.address.length > 255) errs.address = 'Max 255 characters.';

  const slots = parseInt(s1.total_slots, 10);
  if (!s1.total_slots || isNaN(slots) || slots < 1 || slots > 1000)
    errs.total_slots = 'Enter a number between 1 and 1000.';

  const feeFields: Array<keyof Step1> = [
    'fee_2w_first',
    'fee_2w_next',
    'fee_4w_first',
    'fee_4w_next',
  ];
  for (const k of feeFields) {
    const v = parseFloat(s1[k] as string);
    if (s1[k] === '' || isNaN(v) || v < 0) errs[k] = 'Required, must be ≥ 0.';
  }

  return errs;
}

/**
 * Validates Step 2 (admin credentials) and returns a map of field → error message.
 * An empty object means validation passed.
 */
export function validateStep2(s2: Step2): Step2Errors {
  const errs: Step2Errors = {};

  if (!s2.username.trim()) errs.username = 'Username is required.';
  else if (s2.username.length > 50) errs.username = 'Max 50 characters.';

  if (!s2.password) errs.password = 'Password is required.';
  else if (s2.password.length < 6) errs.password = 'At least 6 characters.';

  if (!s2.confirm_password)
    errs.confirm_password = 'Please confirm your password.';
  else if (s2.password !== s2.confirm_password)
    errs.confirm_password = 'Passwords do not match.';

  return errs;
}

/**
 * Assembles the multipart FormData payload for the registration API call.
 */
export function buildRegisterFormData(s1: Step1, s2: Step2): FormData {
  const formData = new FormData();
  formData.append('lot_name', s1.lot_name.trim());
  formData.append('address', s1.address.trim());
  formData.append('total_slots', s1.total_slots);
  formData.append('fee_2w_first', s1.fee_2w_first);
  formData.append('fee_2w_next', s1.fee_2w_next);
  formData.append('fee_4w_first', s1.fee_4w_first);
  formData.append('fee_4w_next', s1.fee_4w_next);
  formData.append('username', s2.username.trim());
  formData.append('password', s2.password);
  formData.append('confirm_password', s2.confirm_password);
  if (s1.layout_image) formData.append('layout_image', s1.layout_image);
  return formData;
}
