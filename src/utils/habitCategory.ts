export const HABIT_CATEGORIES = [
  "Health",
  "Fitness",
  "Work",
  "Learning",
  "Mindset",
  "Personal",
  "Others",
] as const;

export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

export function normalizeHabitCategory(value: unknown): HabitCategory {
  const raw = typeof value === "string" ? value.trim() : "";
  const match = HABIT_CATEGORIES.find((x) => x === raw);
  return match ?? "Others";
}
