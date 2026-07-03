'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, TrainingPlan } from '@/lib/supabase';
import { getSessionColor, thaiToday, getContrastColor } from '@/lib/utils';
import { useTheme } from '@/components/layout/ThemeProvider';
import { computeHRZones } from '@/lib/hrZones';
import { AddRunForm } from '@/components/runs/AddRunForm';
import { DayDetailSheet } from '@/components/plan/DayDetailSheet';
import { CsvImport } from '@/components/plan/CsvImport';
import {
  CalendarBlank, CaretLeft, CaretRight,
  List, UploadSimple, CheckCircle,
  Target, TrendUp, CheckSquare, Timer,
  ClipboardText, CheckFat,
} from '@phosphor-icons/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Bangkok';

function thaiNow() {
  return toZonedTime(new Date(), TZ);
}


export default function PlanPage() {
  const { theme } = useTheme();
  const [viewMonth, setViewMonth] = useState(thaiNow());
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddRun, setShowAddRun] = useState(false);
  const [addRunDate, setAddRunDate] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const hrZones = computeHRZones(185, 42);

  const fetchData = useCallback(async () => {
    try {
      const monthStart = format(startOfMonth(viewMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(viewMonth), 'yyyy-MM-dd');
      const [plansRes, activitiesRes] = await Promise.all([
        supabase.from('training_plan').select('*').gte('date', monthStart).lte('date', monthEnd),
        supabase.from('activities').select('*').gte('date', monthStart).lte('date', monthEnd),
      ]);
      if (plansRes.error) console.error('fetch plans error:', plansRes.error);
      if (activitiesRes.error) console.error('fetch activities error:', activitiesRes.error);
      setPlans(plansRes.data ?? []);
      setActivities(activitiesRes.data ?? []);
    } catch (err) {
      console.error('Error fetching data in PlanPage:', err);
    } finally {
      setLoading(false);
    }
  }, [viewMonth]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  // Index by date
  const planByDate = useMemo(() => {
    const map: Record<string, TrainingPlan> = {};
    plans.forEach((p) => { map[p.date] = p; });
    return map;
  }, [plans]);

  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    activities.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [activities]);

  // Compute summary stats for the current view month
  const stats = useMemo(() => {
    const totalPlannedKm = plans.reduce((sum, p) => sum + (p.distance_km ?? 0), 0);
    const totalActualKm = activities.reduce((sum, a) => sum + (a.distance_km ?? 0), 0);
    const completionRate = totalPlannedKm > 0 ? Math.round((totalActualKm / totalPlannedKm) * 100) : 0;
    const totalRuns = activities.length;

    return {
      totalPlannedKm,
      totalActualKm,
      completionRate,
      totalRuns,
    };
  }, [plans, activities]);


  // Calendar days — memoised to avoid infinite render loop
  const { monthStart, monthEnd, calDays, paddedDays } = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const days = eachDayOfInterval({ start, end });
    const firstDow = (start.getDay() + 6) % 7; // 0=Mon
    const padded: (Date | null)[] = [...Array(firstDow).fill(null), ...days];
    return { monthStart: start, monthEnd: end, calDays: days, paddedDays: padded };
  }, [viewMonth]);

  const todayStr = thaiToday();

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleToggleComplete = async (plan: TrainingPlan) => {
    const { error } = await supabase
      .from('training_plan')
      .update({ completed: !plan.completed, updated_at: new Date().toISOString() })
      .eq('id', plan.id);
    if (!error) {
      setPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, completed: !p.completed } : p));
    }
  };

  const handleLogRun = (date: string) => {
    setAddRunDate(date);
    setSelectedDate(null);
    setShowAddRun(true);
  };

  const handleRunSaved = () => {
    setShowAddRun(false);
    setAddRunDate(null);
    fetchData();
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      {/* Header */}
      <header className="page-header">
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CalendarBlank size={22} color="var(--color-primary)" weight="fill" />
          <h1 style={{ fontSize: '1.5rem', flex: 1 }}>Training Plan</h1>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setShowImport(true)}
            aria-label="Import CSV"
            title="Import CSV"
          >
            <UploadSimple size={20} />
          </button>
        </div>
      </header>

      <div className="page-content" style={{ paddingTop: 16 }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            aria-label="Previous month"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
            {format(viewMonth, 'MMMM yyyy')}
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            aria-label="Next month"
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>

        {/* Monthly Summary Stats */}
        <div className="stats-grid">
          <StatCard
            label="Planned"
            value={stats.totalPlannedKm.toFixed(1)}
            unit="km"
            color="var(--color-primary)"
            icon={Target}
            subtext="Total target"
          />
          <StatCard
            label="Actual"
            value={stats.totalActualKm.toFixed(1)}
            unit="km"
            color="#059669"
            icon={TrendUp}
            subtext="Logged runs"
          />
          <StatCard
            label="Completed %"
            value={`${stats.completionRate}%`}
            color="#FBBF24"
            icon={CheckSquare}
            subtext="Dist. ratio"
          />
          <StatCard
            label="Count Run"
            value={stats.totalRuns}
            unit="runs"
            color="#60A5FA"
            icon={Timer}
            subtext="This month"
          />
        </div>

        <div>
          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3, marginBottom: 4 }}>
            {weekDays.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
              {[...Array(35)].map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: '1', borderRadius: 10 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
              {paddedDays.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} />;
                const dateStr = format(day, 'yyyy-MM-dd');
                const plan = planByDate[dateStr];
                const acts = activitiesByDate[dateStr] ?? [];
                const isToday = dateStr === todayStr;
                const hasPlan = !!plan;
                const hasActivity = acts.length > 0;
                const sessionColor = plan ? getSessionColor(plan.session_type ?? '', theme) : null;

                // Comparison calc for cell indicator
                const plannedKm = plan?.distance_km ?? 0;
                const actualKm = acts.reduce((s, a) => s + (a.distance_km ?? 0), 0);
                const hasDistance = plannedKm > 0 || actualKm > 0;
                const maxKm = Math.max(plannedKm, actualKm, 0.1);
                const planBarW = Math.round((plannedKm / maxKm) * 100);
                const actualBarW = Math.round((actualKm / maxKm) * 100);
                const isOver = hasActivity && plannedKm > 0 && actualKm >= plannedKm - 0.3;

                return (
                  <button
                    key={dateStr}
                    className="calendar-day-btn"
                    onClick={() => handleDayClick(dateStr)}
                    aria-label={`${format(day, 'MMMM d')}${plan ? ': ' + plan.session_type : ''}`}
                    style={{
                      borderRadius: 12,
                      border: isToday ? '2px solid var(--color-primary)' : '2px solid rgba(255,143,163,0.15)',
                      background: hasPlan && sessionColor
                        ? theme === 'dark' ? `${sessionColor}30` : `${sessionColor}18`
                        : isToday ? 'rgba(255,143,163,0.12)' : 'var(--color-bg-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      justifyContent: 'flex-start',
                      padding: '6px',
                      gap: 4,
                      transition: 'all 200ms ease',
                      position: 'relative',
                      WebkitTapHighlightColor: 'transparent',
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(255,143,163,0.08)',
                    }}
                  >
                    {/* Date number */}
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      lineHeight: 1,
                      alignSelf: 'flex-end',
                      marginBottom: 2,
                      fontFamily: "'Baloo 2', sans-serif",
                    }}>
                      {format(day, 'd')}
                    </span>

                    {/* Planned Session Chip */}
                    {hasPlan && (
                      <div
                        className="calendar-event-chip"
                        style={{
                          background: sessionColor ?? '#6B7280',
                          color: getContrastColor(sessionColor ?? '#6B7280'),
                          opacity: plan.completed ? 0.6 : 1,
                        }}
                        title={`${plan.session_type}${plan.distance_km ? ` - ${plan.distance_km}k` : ''}${plan.description ? `: ${plan.description}` : ''}`}
                      >
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {plan.completed ? '✓ ' : ''}
                          {plan.session_type}
                          {plan.distance_km ? ` ${plan.distance_km}k` : ''}
                        </span>
                      </div>
                    )}

                    {/* Actual Activity Chip */}
                    {hasActivity && (
                      <div
                        className="calendar-event-chip"
                        style={{
                          background: isOver || !hasPlan
                            ? (theme === 'dark' ? '#39FF14' : '#A8E6CF')
                            : (theme === 'dark' ? '#EDFF00' : '#FFD5A8'),
                          color: getContrastColor(
                            isOver || !hasPlan
                              ? (theme === 'dark' ? '#39FF14' : '#A8E6CF')
                              : (theme === 'dark' ? '#EDFF00' : '#FFD5A8')
                          ),
                        }}
                        title={`Actual: ${actualKm.toFixed(2)} km`}
                      >
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          ✓ {actualKm.toFixed(1)}k
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingBottom: 4 }}>
            {[
              { label: 'Today', type: 'today' },
              { label: 'Planned Session', type: 'plan-chip' },
              { label: 'Actual Run', type: 'actual-chip' },
              { label: 'Short of Target', type: 'short-chip' },
            ].map(({ label, type }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {type === 'today' && <div style={{ width: 12, height: 12, borderRadius: 4, border: '2px solid var(--color-primary)' }} />}
                {type === 'plan-chip' && (
                  <div style={{ padding: '1px 5px', fontSize: '0.55rem', borderRadius: 4, background: theme === 'dark' ? '#00F3FF' : '#AED9F5', color: getContrastColor(theme === 'dark' ? '#00F3FF' : '#AED9F5'), fontWeight: 700, textTransform: 'uppercase' }}>
                    Plan
                  </div>
                )}
                {type === 'actual-chip' && (
                  <div style={{ padding: '1px 5px', fontSize: '0.55rem', borderRadius: 4, background: theme === 'dark' ? '#39FF14' : '#A8E6CF', color: getContrastColor(theme === 'dark' ? '#39FF14' : '#A8E6CF'), fontWeight: 700, textTransform: 'uppercase' }}>
                    ✓ Run
                  </div>
                )}
                {type === 'short-chip' && (
                  <div style={{ padding: '1px 5px', fontSize: '0.55rem', borderRadius: 4, background: theme === 'dark' ? '#EDFF00' : '#FFD5A8', color: getContrastColor(theme === 'dark' ? '#EDFF00' : '#FFD5A8'), fontWeight: 700, textTransform: 'uppercase' }}>
                    Short
                  </div>
                )}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider / List Title */}
        <div style={{
          marginTop: 28,
          marginBottom: 16,
          borderTop: '2px dashed rgba(255,143,163,0.25)',
          paddingTop: 24,
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--color-foreground)'
          }}>
            <List size={20} color="var(--color-primary)" weight="bold" />
            Monthly Sessions
          </h3>
        </div>

        {/* List view */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calDays.filter(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            return planByDate[dateStr] || (activitiesByDate[dateStr] && activitiesByDate[dateStr].length > 0);
          }).length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px',
              background: 'var(--color-bg-card)',
              borderRadius: 20,
              border: '2px dashed rgba(255,143,163,0.25)',
              color: 'var(--color-text-subtle)',
              fontSize: '0.875rem'
            }}>
              No training sessions or activities scheduled for this month.
            </div>
          ) : (
            calDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const plan = planByDate[dateStr];
              const acts = activitiesByDate[dateStr] ?? [];
              if (!plan && acts.length === 0) return null;
              const color = plan ? getSessionColor(plan.session_type ?? '', theme) : (theme === 'dark' ? '#00FF9F' : '#059669');
              const plannedKm = plan?.distance_km ?? 0;
              const actualKm = acts.reduce((s, a) => s + (a.distance_km ?? 0), 0);
              const distDelta = (plannedKm > 0 && actualKm > 0) ? actualKm - plannedKm : null;
              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className="plan-list-btn"
                  aria-label={`${format(day, 'EEEE d MMMM')}${plan ? ': ' + plan.session_type : ''}`}
                >
                  <div style={{ width: 40, flexShrink: 0, textAlign: 'center', fontFamily: "'Baloo 2', sans-serif" }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{format(day, 'EEE')}</div>
                    <div style={{ fontSize: '1.25rem', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, color: dateStr === todayStr ? 'var(--color-primary)' : 'var(--color-foreground)', lineHeight: 1 }}>{format(day, 'd')}</div>
                  </div>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {plan && (
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>{plan.session_type}</div>
                    )}
                    {plan?.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{plan.description}</div>
                    )}
                    {/* Distance comparison */}
                    {(plannedKm > 0 || actualKm > 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        {plannedKm > 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <ClipboardText size={12} color="var(--color-secondary)" weight="bold" />
                            {plannedKm} km
                          </span>
                        )}
                        {actualKm > 0 && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: acts.length > 0 ? '#059669' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <CheckFat size={12} color="#7FDBB6" weight="fill" />
                            {actualKm.toFixed(2)} km
                          </span>
                        )}
                        {distDelta !== null && (
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px',
                            borderRadius: 999,
                            background: distDelta >= -0.3 ? 'rgba(127,219,182,0.25)' : 'rgba(255,107,129,0.15)',
                            color: distDelta >= -0.3 ? '#059669' : '#FF6B81',
                          }}>
                            {distDelta >= 0 ? `+${distDelta.toFixed(2)}` : distDelta.toFixed(2)} km
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {plan?.completed && <CheckCircle size={20} color="#059669" weight="fill" />}
                </button>
              );
            })
          )}
        </div>

        <div style={{ height: 16 }} />
      </div>

      {/* Day detail sheet */}
      {selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          plan={planByDate[selectedDate] ?? null}
          activities={activitiesByDate[selectedDate] ?? []}
          onClose={() => setSelectedDate(null)}
          onLogRun={() => handleLogRun(selectedDate)}
          onToggleComplete={() => planByDate[selectedDate] && handleToggleComplete(planByDate[selectedDate])}
          hrZones={hrZones}
        />
      )}

      {/* Add run sheet */}
      {showAddRun && (
        <AddRunForm
          activity={null}
          onClose={() => { setShowAddRun(false); setAddRunDate(null); }}
          onSaved={handleRunSaved}
          hrZones={hrZones}
          defaultDate={addRunDate ?? undefined}
        />
      )}

      {/* CSV Import */}
      {showImport && (
        <CsvImport
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchData(); }}
        />
      )}
    </div>
  );
}

// ---- Local Component ----

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  icon?: any;
  subtext?: string;
}

function StatCard({ label, value, unit, color, icon: Icon, subtext }: StatCardProps) {
  return (
    <div className="stat-card" style={{ padding: '10px 14px', borderLeft: `3px solid ${color}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className="stat-label" style={{ fontSize: '0.625rem', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>{label}</span>
        {Icon && (
          <div style={{ background: `${color}1A`, padding: 4, borderRadius: 6, display: 'flex', color: color }}>
            <Icon size={16} color="currentColor" weight="bold" />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 4 }}>
        <span className="stat-value" style={{ fontSize: '1.25rem', lineHeight: 1.1, color: 'var(--color-foreground)' }}>{value}</span>
        {unit && <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{unit}</span>}
      </div>
      {subtext && (
        <span style={{ fontSize: '0.625rem', color: 'var(--color-text-subtle)', marginTop: 2, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
          {subtext}
        </span>
      )}
    </div>
  );
}

