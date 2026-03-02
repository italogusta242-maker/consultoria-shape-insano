/** Returns local date string in YYYY-MM-DD format (avoids UTC timezone shift) */
export const toLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Returns today's local date string */
export const getToday = (): string => toLocalDate(new Date());

/** localStorage helpers with date-based keys */
export const getDailyKey = (prefix: string): string => `${prefix}-${getToday()}`;

export const getDailyValue = <T>(prefix: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(getDailyKey(prefix));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const setDailyValue = <T>(prefix: string, value: T): void => {
  localStorage.setItem(getDailyKey(prefix), JSON.stringify(value));
};
