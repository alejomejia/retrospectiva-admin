import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WaistInput } from "./measurements-field-waist-input";

describe("WaistInput", () => {
  it("shows a single 'Waist' field when not elastic", () => {
    render(
      <WaistInput
        doubles
        min={38}
        max={null}
        onChangeMin={() => {}}
        onChangeMax={() => {}}
      />,
    );
    expect(screen.getByLabelText(/^waist\s*\*?$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/maximum waist/i)).not.toBeInTheDocument();
  });

  it("reveals min/max fields when the elastic toggle is turned on", async () => {
    render(
      <WaistInput
        doubles
        min={38}
        max={null}
        onChangeMin={() => {}}
        onChangeMax={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(screen.getByLabelText(/minimum waist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum waist/i)).toBeInTheDocument();
  });

  it("clears the max when the elastic toggle is turned off", async () => {
    const onChangeMax = vi.fn();
    render(
      <WaistInput
        doubles
        min={38}
        max={44}
        onChangeMin={() => {}}
        onChangeMax={onChangeMax}
      />,
    );
    // Starts elastic because a max is present.
    expect(screen.getByLabelText(/maximum waist/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch"));
    expect(onChangeMax).toHaveBeenCalledWith(null);
    expect(screen.queryByLabelText(/maximum waist/i)).not.toBeInTheDocument();
  });
});
