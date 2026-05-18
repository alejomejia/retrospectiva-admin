"use client";

import { addMonths, addMinutes, format, isAfter, isBefore } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/lib/i18n/messages.es";
import {
  MAX_SCHEDULE_LEAD_MONTHS as MAX_LEAD_MONTHS,
  MIN_SCHEDULE_LEAD_MINUTES as MIN_LEAD_MINUTES,
} from "@/lib/products/schedule-constants";
import { cn } from "@/lib/utils/helpers";

/**
 * Date + time picker for the "Programar" action. Display is local
 * (browser's Europe/Madrid for the user); the value the parent
 * receives is a UTC ISO string ready for the DB / queue.
 *
 * Enforces ≥ 5 min lead and ≤ 6 months ahead (sanity caps).
 */
export function SchedulePicker({
  value,
  onChange,
  disabled,
}: {
  /** ISO UTC string, or `null` if unscheduled. */
  value: string | null;
  onChange: (nextIsoUtc: string | null) => void;
  disabled?: boolean;
}) {
  const initial = useMemo(
    () => (value ? new Date(value) : null),
    [value],
  );
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

  return (
    <div className="space-y-2">
      <Label className="text-caplet">{m.products.stepper.publish.scheduleLabel}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn("gap-2", !date && "text-muted-foreground")}
            >
              <CalendarIcon className="size-4" />
              {date
                ? format(date, "EEE dd MMM yyyy")
                : m.products.stepper.publish.scheduleDatePlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date ?? undefined}
              onSelect={(d) => {
                setDate(d ?? null);
                commit(d ?? null, timeStr);
              }}
              captionLayout="dropdown"
              disabled={(d) => isBefore(d, new Date(new Date().toDateString()))}
            />
          </PopoverContent>
        </Popover>

        <Input
          type="time"
          step={60}
          value={timeStr}
          onChange={(e) => setTimeStr(e.target.value)}
          onBlur={() => commit(date, timeStr)}
          className="w-32"
          disabled={disabled || !date}
        />

        {date && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDate(null);
              onChange(null);
              setError(null);
            }}
          >
            {m.products.stepper.publish.scheduleClear}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-brand-terracotta">{error}</p>}
      {!error && date && value && (
        <p className="text-xs text-muted-foreground">
          {m.products.stepper.publish.scheduleConfirm(
            format(new Date(value), "EEE dd MMM yyyy, HH:mm"),
          )}
        </p>
      )}
    </div>
  );
}
