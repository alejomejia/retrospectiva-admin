"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/lib/i18n/messages.es";

export function BraSizeInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [text, setText] = useState(value ?? "");
  return (
    <div className="space-y-1">
      <Label htmlFor="meas-bra-size" className="text-caplet" required>
        {m.products.form.measurements.braSize}
      </Label>
      <Input
        id="meas-bra-size"
        type="text"
        autoComplete="off"
        placeholder="90B"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.trim() === "" ? null : text.trim())}
      />
    </div>
  );
}
