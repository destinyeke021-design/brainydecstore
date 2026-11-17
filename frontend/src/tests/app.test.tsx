import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../pages/Auth";
import { money, toMinor } from "../utils/format";
import { Countdown } from "../components/ui";

describe("money helpers", () => {
  it("converts to integer minor units without float drift", () => {
    expect(toMinor("19.99")).toBe(1999);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });
  it("formats NGN", () => expect(money(150000)).toContain("1,500.00"));
});
describe("form validation", () => {
  it("rejects bad login", () => expect(loginSchema.safeParse({ email: "x", password: "" }).success).toBe(false));
  it("accepts valid registration", () =>
    expect(registerSchema.safeParse({ first_name: "A", last_name: "B", phone: "08012345", email: "a@b.com", password: "Str0ng!Pass" }).success).toBe(true));
  it("rejects short password", () =>
    expect(registerSchema.safeParse({ first_name: "A", last_name: "B", phone: "08012345", email: "a@b.com", password: "123" }).success).toBe(false));
});
describe("Countdown", () => {
  it("shows ended for past dates", () => {
    render(<Countdown endsAt={new Date(Date.now() - 1000).toISOString()} />);
    expect(screen.getByText("ended")).toBeInTheDocument();
  });
});
