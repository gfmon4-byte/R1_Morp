'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, TrainingPlan } from '@/lib/supabase';
import { getSessionColor, thaiToday } from '@/lib/utils';
import { computeHRZones } from '@/lib/hrZones';
import { AddRunForm } from '@/components/runs/AddRunForm';
import { DayDetailSheet } from '@/components/plan/DayDetailSheet';
import { CsvImport } from '@/components/plan/CsvImport';
import {
  CalendarBlank, CaretLeft, CaretRight,
  List, UploadSimple, CheckCircle,
} from '@phosphor-icons/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Bangkok';

function thaiNow() {
  return toZonedTime(new Date(), TZ);
}

function getContrastColor(sessionType: string): string {
  if (sessionType === 'Recovery Run' || sessionType === 'Race') {
    return '#0F172A';
  }
  return '#FFFFFF';
}


export default function PlanPage() {
  const [viewMonth, setViewMonth] = useState(thaiNow());
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddRun, setShowAddRun] = useState(false);
  const [addRunDate, setAddRunDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
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
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
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
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setViewMode(v => v === 'calendar' ? 'list' : 'calendar')}
            aria-label="Toggle view"
            title={viewMode === 'calendar' ? 'List view' : 'Calendar view'}
          >
            <List size={20} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px', paddingTop: 16 }}>
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

        {viewMode === 'calendar' ? (
          <div>
            {/* Day labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
              {weekDays.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '4px 0' }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {[...Array(35)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ aspectRatio: '1', borderRadius: 10 }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {paddedDays.map((day, i) => {
                  if (!day) return <div key={`pad-${i}`} />;
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const plan = planByDate[dateStr];
                  const acts = activitiesByDate[dateStr] ?? [];
                  const isToday = dateStr === todayStr;
                  const hasPlan = !!plan;
                  const hasActivity = acts.length > 0;
                  const sessionColor = plan ? getSessionColor(plan.session_type ?? '') : null;

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
                        borderRadius: 10,
                        border: isToday ? '1.5px solid var(--color-primary)' : '1px solid transparent',
                        background: hasPlan && sessionColor
                          ? `${sessionColor}12`
                          : isToday ? 'var(--color-primary-soft)' : 'var(--color-bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        justifyContent: 'flex-start',
                        padding: '6px',
                        gap: 4,
                        transition: 'all 0.15s',
                        position: 'relative',
                        WebkitTapHighlightColor: 'transparent',
                        overflow: 'hidden',
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
                      }}>
                        {format(day, 'd')}
                      </span>

                      {/* Planned Session Chip */}
                      {hasPlan && (
                        <div
                          className="calendar-event-chip"
                          style={{
                            background: sessionColor ?? '#6B7280',
                            color: getContrastColor(plan.session_type ?? ''),
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
                            background: isOver || !hasPlan ? '#059669' : 'var(--color-secondary)',
                            color: '#FFFFFF',
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
                { label: 'Target Short', type: 'short-chip' },
              ].map(({ label, type }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {type === 'today' && <div style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px solid var(--color-primary)' }} />}
                  {type === 'plan-chip' && (
                    <div style={{ padding: '1px 5px', fontSize: '0.55rem', borderRadius: 3, background: '#60A5FA', color: '#fff', fontWeight: 600, textTransform: 'uppercase' }}>
                      Plan
                    </div>
                  )}
                  {type === 'actual-chip' && (
                    <div style={{ padding: '1px 5px', fontSize: '0.55rem', borderRadius: 3, background: '#059669', color: '#fff', fontWeight: 600, textTransform: 'uppercase' }}>
                      ✓ Run
                    </div>
                  )}
                  {type === 'short-chip' && (
                    <div style={{ padding: '1px 5px', fontSize: '0.55rem', borderRadius: 3, background: 'var(--color-secondary)', color: '#fff', fontWeight: 600, textTransform: 'uppercase' }}>
                      Short
                    </div>
                  )}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* List view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {calDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const plan = planByDate[dateStr];
              const acts = activitiesByDate[dateStr] ?? [];
              if (!plan && acts.length === 0) return null;
              const color = plan ? getSessionColor(plan.session_type ?? '') : '#059669';
              const plannedKm = plan?.distance_km ?? 0;
              const actualKm = acts.reduce((s, a) => s + (a.distance_km ?? 0), 0);
              const distDelta = (plannedKm > 0 && actualKm > 0) ? actualKm - plannedKm : null;
              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                    borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                    width: '100%', WebkitTapHighlightColor: 'transparent',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ width: 40, flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{format(day, 'EEE')}</div>
                    <div style={{ fontSize: '1.25rem', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, color: dateStr === todayStr ? 'var(--color-primary)' : 'var(--color-text)', lineHeight: 1 }}>{format(day, 'd')}</div>
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
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            📋 {plannedKm} km
                          </span>
                        )}
                        {actualKm > 0 && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: acts.length > 0 ? '#059669' : 'var(--color-text-muted)' }}>
                            ✅ {actualKm.toFixed(2)} km
                          </span>
                        )}
                        {distDelta !== null && (
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 700, padding: '1px 5px',
                            borderRadius: 5,
                            background: distDelta >= -0.3 ? '#05966920' : '#EF444420',
                            color: distDelta >= -0.3 ? '#059669' : '#EF4444',
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
            }).filter(Boolean)}
          </div>
        )}

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
