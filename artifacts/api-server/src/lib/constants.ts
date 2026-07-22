/** Number of days a new student or institute trial lasts before requireActiveAccount gates them. */
export const TRIAL_DURATION_DAYS = 14;

export function computeTrialEndsAt(now: Date = new Date()): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + TRIAL_DURATION_DAYS);
  return end;
}
