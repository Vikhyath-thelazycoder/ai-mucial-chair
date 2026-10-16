import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ChairLanding from "./page";

const secret = "f".repeat(48);

describe("/c/[chairId] landing page", () => {
  it("tells the person to scan from the website and links to /play", async () => {
    render(await ChairLanding());
    expect(screen.getByText(/scan this chair from the ai musical chair website/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /open the game/i }).getAttribute("href")).toBe("/play");
  });

  it("never echoes the chair secret into the page", async () => {
    const { container } = render(
      await ChairLanding(),
    );
    expect(container.innerHTML).not.toContain(secret);
  });

  it("has no side effects: no Supabase or RPC use in the page module", () => {
    const source = readFileSync(join(process.cwd(), "src/app/c/[chairId]/page.tsx"), "utf8");
    expect(source).not.toMatch(/supabase|rpc\(|fetch\(/i);
  });
});
