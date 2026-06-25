"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { m } from "@/lib/i18n/messages.es";
import type {
  StoryFieldDef,
  StoryFields,
} from "@/lib/products/instagram-story-fields";

import { InstagramStudioCountryField } from "./instagram-studio-country-field";

/**
 * One labelled input per editable text slot of the current template, in
 * `STORY_FIELDS` order. Multiline slots get a textarea. Values are the
 * resolved copy (defaults until the user edits); the labels are Spanish
 * UI even though the field content stays English.
 *
 * `onChange` keeps local state current (so downloads carry the edit); the
 * preview regenerates on `onCommit`, fired when an input loses focus.
 */
export function InstagramStudioFieldsForm({
  fieldDefs,
  fields,
  onChange,
  onCommit,
  onCommitField,
}: {
  fieldDefs: readonly StoryFieldDef[];
  fields: StoryFields;
  onChange: (key: string, value: string) => void;
  onCommit: () => void;
  /** Set + commit a single field atomically — for the country combobox. */
  onCommitField: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {fieldDefs.map((def) => {
        const id = `story-field-${def.key}`;
        const value = fields[def.key] ?? "";
        // Hide a dependent control (e.g. the discount toggle) when the field
        // it gates has no value to show.
        if (def.dependsOn && !(fields[def.dependsOn] ?? "")) return null;
        if (def.toggle) {
          return (
            <div
              key={def.key}
              className="flex items-center justify-between gap-2"
            >
              <Label htmlFor={id}>{m.socials.fields[def.key]}</Label>
              <Switch
                id={id}
                checked={value === "1"}
                onCheckedChange={(checked) =>
                  onCommitField(def.key, checked ? "1" : "")
                }
              />
            </div>
          );
        }
        return (
          <div key={def.key} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{m.socials.fields[def.key]}</Label>
            {def.country ? (
              <InstagramStudioCountryField
                id={id}
                value={value}
                onChange={(code) => onCommitField(def.key, code)}
              />
            ) : def.multiline ? (
              <Textarea
                id={id}
                value={value}
                rows={2}
                onChange={(event) => onChange(def.key, event.target.value)}
                onBlur={onCommit}
              />
            ) : (
              <Input
                id={id}
                value={value}
                onChange={(event) => onChange(def.key, event.target.value)}
                onBlur={onCommit}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
