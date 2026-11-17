/** Money is integer minor units (kobo). Convert only for display. */
export const money = (minor: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(minor / 100);
export const toMinor = (major: string | number) => Math.round(Number(major) * 100);
