"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/Badge";
import type { Profile } from "@/lib/types";
import { upsertProfile } from "@/lib/actions/data";
import { computeHRZones, formatZoneRange } from "@/lib/hrZones";
import { computeAge } from "@/lib/dates";
import { pbPaceEquivalent } from "@/lib/pace";
import { cn } from "@/lib/utils";

import { nullableNumber } from "@/lib/schemas";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  gender: z.string(),
  birth_date: z.string().nullable(),
  vo2max: nullableNumber,
  vt2_percent: nullableNumber,
  weight_kg: nullableNumber,
  height_cm: nullableNumber,
  pb_5k: z.string().nullable(),
  pb_10k: z.string().nullable(),
  pb_half: z.string().nullable(),
  pb_marathon: z.string().nullable(),
  hr_max: nullableNumber,
  hr_rest: nullableNumber,
  pace_zone_1_min: z.string().nullable(),
  pace_zone_1_max: z.string().nullable(),
  pace_zone_2_min: z.string().nullable(),
  pace_zone_2_max: z.string().nullable(),
  pace_zone_3_min: z.string().nullable(),
  pace_zone_3_max: z.string().nullable(),
  pace_zone_4_min: z.string().nullable(),
  pace_zone_4_max: z.string().nullable(),
  pace_zone_5_min: z.string().nullable(),
  pace_zone_5_max: z.string().nullable(),
});

type FormValues = z.output<typeof profileSchema>;

const VT2_ELITE_MIN = 85;
const VT2_ELITE_MAX = 90;

export function ProfileClient({ profile }: { profile: Profile | null }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaults: FormValues = {
    name: profile?.name ?? "",
    gender: profile?.gender ?? "",
    birth_date: profile?.birth_date ?? "",
    vo2max: profile?.vo2max ?? null,
    vt2_percent: profile?.vt2_percent ?? null,
    weight_kg: profile?.weight_kg ?? null,
    height_cm: profile?.height_cm ?? null,
    pb_5k: profile?.pb_5k ?? "",
    pb_10k: profile?.pb_10k ?? "",
    pb_half: profile?.pb_half ?? "",
    pb_marathon: profile?.pb_marathon ?? "",
    hr_max: profile?.hr_max ?? null,
    hr_rest: profile?.hr_rest ?? null,
    pace_zone_1_min: profile?.pace_zone_1_min ?? "",
    pace_zone_1_max: profile?.pace_zone_1_max ?? "",
    pace_zone_2_min: profile?.pace_zone_2_min ?? "",
    pace_zone_2_max: profile?.pace_zone_2_max ?? "",
    pace_zone_3_min: profile?.pace_zone_3_min ?? "",
    pace_zone_3_max: profile?.pace_zone_3_max ?? "",
    pace_zone_4_min: profile?.pace_zone_4_min ?? "",
    pace_zone_4_max: profile?.pace_zone_4_max ?? "",
    pace_zone_5_min: profile?.pace_zone_5_min ?? "",
    pace_zone_5_max: profile?.pace_zone_5_max ?? "",
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  const watchBirth = watch("birth_date");
  const watchHrMax = watch("hr_max");
  const watchHrRest = watch("hr_rest");
  const watchVt2 = watch("vt2_percent");
  const watchVo2 = watch("vo2max");

  const age = useMemo(() => computeAge(watchBirth || null), [watchBirth]);

  const hrZones = useMemo(() => {
    const max = Number(watchHrMax);
    const rest = Number(watchHrRest);
    if (!max || !rest || max <= rest) return null;
    return computeHRZones(max, rest);
  }, [watchHrMax, watchHrRest]);

  const vt2Position = useMemo(() => {
    const vt2 = Number(watchVt2);
    if (!vt2) return null;
    if (vt2 < VT2_ELITE_MIN) return "below";
    if (vt2 > VT2_ELITE_MAX) return "above";
    return "in";
  }, [watchVt2]);

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      await upsertProfile({
        name: values.name,
        gender: values.gender,
        birth_date: values.birth_date || null,
        vo2max: values.vo2max,
        vt2_percent: values.vt2_percent,
        weight_kg: values.weight_kg,
        height_cm: values.height_cm,
        pb_5k: values.pb_5k || null,
        pb_10k: values.pb_10k || null,
        pb_half: values.pb_half || null,
        pb_marathon: values.pb_marathon || null,
        hr_max: values.hr_max,
        hr_rest: values.hr_rest,
        pace_zone_1_min: values.pace_zone_1_min || null,
        pace_zone_1_max: values.pace_zone_1_max || null,
        pace_zone_2_min: values.pace_zone_2_min || null,
        pace_zone_2_max: values.pace_zone_2_max || null,
        pace_zone_3_min: values.pace_zone_3_min || null,
        pace_zone_3_max: values.pace_zone_3_max || null,
        pace_zone_4_min: values.pace_zone_4_min || null,
        pace_zone_4_max: values.pace_zone_4_max || null,
        pace_zone_5_min: values.pace_zone_5_min || null,
        pace_zone_5_max: values.pace_zone_5_max || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const pbFields = [
    { key: "pb_5k" as const, label: "5K", dist: 5 },
    { key: "pb_10k" as const, label: "10K", dist: 10 },
    { key: "pb_half" as const, label: "Half Marathon", dist: 21.0975 },
    { key: "pb_marathon" as const, label: "Marathon", dist: 42.195 },
  ];

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Your stats drive HR zones app-wide"
      />

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <h2 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Personal Info
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" error={errors.name?.message} {...register("name")} />
            <Select label="Gender" {...register("gender")}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
            <Input label="Birth Date" type="date" {...register("birth_date")} />
            <div className="flex flex-col justify-end">
              <span className="text-sm font-medium text-foreground">Age</span>
              <p className="mt-2 font-tabular text-lg">{age ?? "—"}</p>
            </div>
            <Input label="Weight (kg)" type="number" step="0.1" {...register("weight_kg")} />
            <Input label="Height (cm)" type="number" {...register("height_cm")} />
          </div>
        </Card>

        <Card>
          <h2 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Performance
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="VO2max (mL/kg/min)"
              type="number"
              step="0.1"
              {...register("vo2max")}
            />
            <Input
              label="VT2 (% of VO2max)"
              type="number"
              step="0.1"
              {...register("vt2_percent")}
            />
            <Input label="HR Max (bpm)" type="number" {...register("hr_max")} />
            <Input label="HR Rest (bpm)" type="number" {...register("hr_rest")} />
          </div>

          {watchVt2 && (
            <div className="mt-4 rounded-xl bg-surface p-4">
              <p className="mb-2 text-xs text-muted">
                Elite benchmark: {VT2_ELITE_MIN}–{VT2_ELITE_MAX}% VO2max
              </p>
              <div className="relative h-3 rounded-full bg-border">
                <div
                  className="absolute h-full rounded-full bg-accent/30"
                  style={{
                    left: `${VT2_ELITE_MIN}%`,
                    width: `${VT2_ELITE_MAX - VT2_ELITE_MIN}%`,
                  }}
                />
                {watchVt2 && (
                  <div
                    className={cn(
                      "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-background",
                      vt2Position === "in" ? "bg-success" : "bg-warning"
                    )}
                    style={{ left: `calc(${Math.min(Number(watchVt2), 100)}% - 8px)` }}
                  />
                )}
              </div>
              <p className="mt-2 text-sm">
                Your VT2: <strong>{watchVt2}%</strong>
                {vt2Position === "in" && (
                  <span className="ml-2 text-success">Within elite range</span>
                )}
                {vt2Position === "below" && (
                  <span className="ml-2 text-warning">Below elite range</span>
                )}
                {vt2Position === "above" && (
                  <span className="ml-2 text-accent">Above elite range</span>
                )}
              </p>
              {watchVo2 && watchVt2 && (
                <p className="mt-1 text-xs text-muted">
                  VT2 absolute: {((Number(watchVo2) * Number(watchVt2)) / 100).toFixed(1)} mL/kg/min
                </p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Personal Bests
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {pbFields.map(({ key, label, dist }) => {
              const val = watch(key);
              const pace = pbPaceEquivalent(val || null, dist);
              return (
                <div key={key}>
                  <Input
                    label={`${label} (H:MM:SS or MM:SS)`}
                    placeholder="18:33"
                    {...register(key)}
                  />
                  {pace && (
                    <p className="mt-1 text-xs text-muted">Pace: {pace}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Pace Zones (editable)
          </h2>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((z) => (
              <div key={z} className="grid grid-cols-[auto_1fr_1fr] items-end gap-3">
                <span className="pb-3 text-sm font-medium text-muted w-8">Z{z}</span>
                <Input
                  label="Min"
                  placeholder="7:00/km"
                  {...register(`pace_zone_${z}_min` as keyof FormValues)}
                />
                <Input
                  label="Max"
                  placeholder="7:20/km"
                  {...register(`pace_zone_${z}_max` as keyof FormValues)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            HR Zones (auto-computed)
          </h2>
          <p className="mb-4 text-sm text-muted">
            Calculated from HR Max and HR Rest using the Karvonen (Heart Rate Reserve)
            formula. Updates automatically when you change those values — no manual sync needed.
          </p>
          {hrZones ? (
            <ul className="space-y-2">
              {hrZones.map((zone) => (
                <li
                  key={zone.key}
                  className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm"
                >
                  <span>{formatZoneRange(zone)}</span>
                  <span className="text-muted">{zone.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Enter HR Max and HR Rest above to see your zones.
            </p>
          )}
        </Card>

        <Button type="submit" loading={loading} size="lg" className="w-full sm:w-auto">
          {saved ? "Saved!" : "Save Profile"}
        </Button>
      </form>
    </>
  );
}
