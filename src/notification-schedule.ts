export interface ReminderSchedule {
  timezone: string;
  time: string;
  quietStart: string;
  quietEnd: string;
  category: "daily" | "weekly";
}
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function inQuietHours(time: string, start: string, end: string) {
  if (start === end) return false;
  return start < end
    ? time >= start && time < end
    : time >= start || time < end;
}
export function nextReminder(schedule: ReminderSchedule, after: Date): string {
  if (![schedule.time, schedule.quietStart, schedule.quietEnd].every(validTime))
    throw new Error("Choose valid reminder and quiet-hour times.");
  if (!["daily", "weekly"].includes(schedule.category))
    throw new Error("Choose a supported reminder category.");
  if (inQuietHours(schedule.time, schedule.quietStart, schedule.quietEnd))
    throw new Error("Choose a reminder time outside your quiet hours.");
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: schedule.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const local = (date: Date) => {
    const parts = format.formatToParts(date);
    const get = (name: string) =>
      parts.find((part) => part.type === name)!.value;
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  };
  const today = local(after).slice(0, 10);
  for (let offset = 0; offset < 9; offset++) {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    if (schedule.category === "weekly" && day.getUTCDay() !== 0) continue;
    const target = `${day.toISOString().slice(0, 10)}T${schedule.time}`;
    const targetMs = Date.parse(`${target}:00Z`);
    let guess = targetMs;
    for (let attempt = 0; attempt < 4; attempt++)
      guess += targetMs - Date.parse(`${local(new Date(guess))}:00Z`);
    // Skip a nonexistent wall-clock time at a daylight-saving transition.
    if (local(new Date(guess)) === target && guess > after.getTime())
      return new Date(guess).toISOString();
  }
  throw new Error("No valid reminder time was found. Choose another time.");
}
