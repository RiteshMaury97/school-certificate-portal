/** Patterns used by native HTML validation, which browsers compile with Unicode sets (`v`). */
export const PERSON_NAME_PATTERN = String.raw`[\p{L}\p{M} .'\-]+`;

export const PHONE_NUMBER_PATTERN = String.raw`(?:[6-9][0-9]{9}|[+]91(?:[ ]|-)?[6-9][0-9]{5}(?:[ ]|-)?[0-9]{5}|[+][1-9][0-9]{7,14})`;
