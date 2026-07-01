import { z } from "zod";

/** Zod 4-compatible nullable number for form inputs */
export const nullableNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isNaN(n) ? null : n;
  });

export const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    const n = typeof val === "number" ? val : Number(val);
    return Number.isNaN(n) ? undefined : n;
  })
  .optional();

export const zoneMinutes = z
  .union([z.number(), z.string()])
  .transform((val) => {
    const n = typeof val === "number" ? val : Number(val);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  });

export const nullableRpe = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const n = typeof val === "number" ? val : Number(val);
    if (Number.isNaN(n)) return null;
    return Math.min(10, Math.max(1, n));
  })
  .nullable()
  .optional();
