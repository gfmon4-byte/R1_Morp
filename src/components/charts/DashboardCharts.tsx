"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ZONE_COLORS, type ZoneKey } from "@/lib/hrZones";

const CHART_GRID = "#2a3544";
const CHART_TEXT = "#8b9cb3";

export function WeeklyDistanceChart({
  data,
}: {
  data: { week: string; km: number }[];
}) {
  if (data.every((d) => d.km === 0)) {
    return <ChartEmpty message="No weekly distance data yet" />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fill: CHART_TEXT, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: CHART_TEXT, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          unit=" km"
        />
        <Tooltip
          contentStyle={{
            background: "#1a2332",
            border: "1px solid #2a3544",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [`${Number(value).toFixed(1)} km`, "Distance"]}
        />
        <Bar dataKey="km" fill="#c8ff00" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyVolumeChart({
  data,
}: {
  data: { month: string; km: number }[];
}) {
  if (data.every((d) => d.km === 0)) {
    return <ChartEmpty message="No monthly volume data yet" />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: CHART_TEXT, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: CHART_TEXT, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          unit=" km"
        />
        <Tooltip
          contentStyle={{
            background: "#1a2332",
            border: "1px solid #2a3544",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [`${Number(value).toFixed(1)} km`, "Volume"]}
        />
        <Bar dataKey="km" fill="#9bc400" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HRZoneDistributionChart({
  data,
}: {
  data: { name: string; minutes: number; key: ZoneKey }[];
}) {
  const total = data.reduce((s, d) => s + d.minutes, 0);
  if (total === 0) {
    return <ChartEmpty message="No HR zone data for this period" />;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="minutes"
          nameKey="name"
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={ZONE_COLORS[entry.key]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#1a2332",
            border: "1px solid #2a3544",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, _name, props) => {
            const mins = Number(value);
            const pct = total > 0 ? ((mins / total) * 100).toFixed(0) : 0;
            return [`${mins} min (${pct}%)`, props.payload.name];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, color: CHART_TEXT }}
          formatter={(value) => (
            <span style={{ color: CHART_TEXT }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted">
      {message}
    </div>
  );
}
