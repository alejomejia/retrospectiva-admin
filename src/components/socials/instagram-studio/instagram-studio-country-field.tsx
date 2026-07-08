"use client";

import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { m } from "@/lib/i18n/messages.en";
import {
  STORY_COUNTRIES,
  findStoryCountry,
} from "@/lib/products/instagram-story-countries";

/**
 * Searchable, alphabetical country picker for the "sold" story's destination
 * line. The value is an ISO alpha-2 code (`""` for none); the footer line is
 * composed from it at render time (see `composeSoldTagline`). Selecting the
 * already-selected country, or the clear action, resets to `""`.
 */
export function InstagramStudioCountryField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = findStoryCountry(value);

  function select(code: string) {
    onChange(code === value ? "" : code);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal"
          >
            {selected ? (
              <span>
                {selected.flag} {selected.name}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {m.socials.studio.countryPlaceholder}
              </span>
            )}
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput
              placeholder={m.socials.studio.countrySearchPlaceholder}
            />
            <CommandList>
              <CommandEmpty>{m.socials.studio.countryEmpty}</CommandEmpty>
              <CommandGroup>
                {STORY_COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => select(country.code)}
                  >
                    <CheckIcon
                      className={
                        country.code === value ? "opacity-100" : "opacity-0"
                      }
                    />
                    <span>
                      {country.flag} {country.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={m.socials.studio.countryClear}
          onClick={() => onChange("")}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
