"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/lib/i18n/messages.en";
import { cn } from "@/lib/utils/helpers";

import { useSchedulePicker } from "./use-schedule-picker";

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
  const vm = useSchedulePicker({ value, onChange });

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
              className={cn("gap-2", !vm.date && "text-muted-foreground")}
            >
              <CalendarIcon className="size-4" />
              {vm.date
                ? format(vm.date, "EEE dd MMM yyyy")
                : m.products.stepper.publish.scheduleDatePlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={vm.date ?? undefined}
              onSelect={vm.handleDateSelect}
              captionLayout="dropdown"
              disabled={vm.calendarDisabled}
            />
          </PopoverContent>
        </Popover>

        <Input
          type="time"
          step={60}
          value={vm.timeStr}
          onChange={(e) => vm.setTimeStr(e.target.value)}
          onBlur={vm.handleTimeBlur}
          className="w-32 flex-1"
          disabled={disabled || !vm.date}
        />

        {vm.date && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={vm.handleClear}
          >
            {m.products.stepper.publish.scheduleClear}
          </Button>
        )}
      </div>
      {vm.error && <p className="text-xs text-brand-terracotta">{vm.error}</p>}
      {!vm.error && vm.date && value && (
        <p className="text-xs text-muted-foreground">
          {m.products.stepper.publish.scheduleConfirm(
            format(new Date(value), "EEE dd MMM yyyy, HH:mm"),
          )}
        </p>
      )}
    </div>
  );
}
