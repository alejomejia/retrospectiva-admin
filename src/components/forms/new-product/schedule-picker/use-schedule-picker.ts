"use client";

import { addMonths, addMinutes, format, isAfter, isBefore } from "date-fns";
import { useMemo, useState } from "react";

import { m } from "@/lib/i18n/messages.en";

import { MAX_LEAD_MONTHS, MIN_LEAD_MINUTES } from "./schedule-picker.const";

type Args = {
  value: string | null;
  onChange: (nextIsoUtc: string | null) => void;
};

export function useSchedulePicker({ value, onChange }: Args) {
  const initial = useMemo(() => (value ? new Date(value) : null), [value]);
  const [date, setDate] = useState<Date | null>(initial);
  const [timeStr, setTimeStr] = useState<string>(
    initial ? format(initial, "HH:mm") : "12:00",
  );
  const [error, setError] = useState<string | null>(null);

  const commit = (nextDate: Date | null, nextTimeStr: string) => {
    if (!nextDate) {
      onChange(null);
      setError(null);
      return;
    }
    const [hh, mm] = nextTimeStr.split(":").map(Number);
    if (
      !Number.isFinite(hh) ||
      !Number.isFinite(mm) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59
    ) {
      setError(m.products.stepper.publish.scheduleTimeInvalid);
      return;
    }
    const merged = new Date(nextDate);
    merged.setHours(hh, mm, 0, 0);
    const now = new Date();
    if (isBefore(merged, addMinutes(now, MIN_LEAD_MINUTES))) {
      setError(m.products.stepper.publish.scheduleTooSoon(MIN_LEAD_MINUTES));
      return;
    }
    if (isAfter(merged, addMonths(now, MAX_LEAD_MONTHS))) {
      setError(m.products.stepper.publish.scheduleTooFar(MAX_LEAD_MONTHS));
      return;
    }
    setError(null);
    onChange(merged.toISOString());
  };

  const handleDateSelect = (d: Date | undefined) => {
    setDate(d ?? null);
    commit(d ?? null, timeStr);
  };

  const handleTimeBlur = () => commit(date, timeStr);

  const handleClear = () => {
    setDate(null);
    onChange(null);
    setError(null);
  };

  const calendarDisabled = (d: Date) =>
    isBefore(d, new Date(new Date().toDateString()));

  return {
    date,
    timeStr,
    setTimeStr,
    error,
    handleDateSelect,
    handleTimeBlur,
    handleClear,
    calendarDisabled,
  };
}
