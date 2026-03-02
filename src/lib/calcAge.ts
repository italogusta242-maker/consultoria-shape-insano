import { differenceInYears } from "date-fns";

/**
 * Calculate age from a birth date string (DD/MM/YYYY or YYYY-MM-DD).
 * Returns null if the date is invalid.
 */
export const calcAge = (nascimento: string | null | undefined): number | null => {
  if (!nascimento) return null;

  let date: Date;
  if (nascimento.includes("/")) {
    const [d, m, y] = nascimento.split("/");
    date = new Date(Number(y), Number(m) - 1, Number(d));
  } else {
    date = new Date(nascimento);
  }

  if (isNaN(date.getTime())) return null;
  return differenceInYears(new Date(), date);
};

/**
 * Return a human-readable age range label.
 */
export const getAgeRange = (nascimento: string | null | undefined): string => {
  const age = calcAge(nascimento);
  if (age === null) return "—";
  if (age < 18) return "Menor de 18";
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  return "56+";
};
