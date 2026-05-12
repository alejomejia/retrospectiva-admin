import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label", () => {
    render(<Button>Publish</Button>);
    expect(screen.getByRole("button", { name: /publish/i })).toBeInTheDocument();
  });

  it("fires onClick", async () => {
    let clicked = 0;
    render(<Button onClick={() => (clicked += 1)}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(clicked).toBe(1);
  });
});
