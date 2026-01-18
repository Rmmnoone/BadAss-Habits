export function isDueToday(habit: any, weekday1to7: number): boolean {
  const type = habit?.schedule?.type ?? "daily";
  if (type === "daily") return true;

  const days: number[] = habit?.schedule?.daysOfWeek ?? [];
  return Array.isArray(days) && days.includes(weekday1to7);
}

export function hasExactReminder(habit: any): boolean {
  return Boolean(habit?.reminders?.enabled) && typeof habit?.reminders?.time === "string";
}
