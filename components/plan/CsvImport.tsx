'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, UploadSimple, CheckCircle, Warning, Trash, ArrowsMerge } from '@phosphor-icons/react';
import Papa from 'papaparse';

interface CsvRow {
  date: string;
  day_of_week?: string;
  phase?: string;
  session_type?: string;
  description?: string;
  distance_km?: string;
  pace_target?: string;
  hr_zone?: string;
  rpe?: string;
  notes?: string;
}

type ImportMode = 'replace' | 'merge';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function CsvImport({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    overwritten: number;
    newAdded: number;
    deleted?: number;
    errors: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<ImportMode>('merge');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    Papa.parse<CsvRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setPreview(results.data.slice(0, 5));
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    const errors: string[] = [];
    let imported = 0;
    let deleted = 0;
    let overwritten = 0;

    await new Promise<void>((resolve) => {
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rows = results.data;

            // Build clean rows for upsert
            const cleanRows = rows.map((row, idx) => {
              if (!row.date) {
                errors.push(`Row ${idx + 2}: missing date`);
                return null;
              }
              return {
                date: row.date.trim(),
                day_of_week: row.day_of_week?.trim() || null,
                phase: row.phase?.trim() || null,
                session_type: row.session_type?.trim() || null,
                description: row.description?.trim() || null,
                distance_km: row.distance_km ? parseFloat(row.distance_km) : null,
                pace_target: row.pace_target?.trim() || null,
                hr_zone: row.hr_zone?.trim() || null,
                rpe: row.rpe?.trim() || null,
                notes: row.notes?.trim() || null,
                completed: false,
                updated_at: new Date().toISOString(),
              };
            }).filter(Boolean) as Record<string, unknown>[];

            // --- REPLACE MODE: delete everything first ---
            if (mode === 'replace') {
              const { error: delErr, data: delData } = await supabase
                .from('training_plan')
                .delete()
                .neq('date', '1900-01-01') // match all rows by date to avoid UUID syntax error
                .select('id');
              if (delErr) {
                errors.push(`Delete failed: ${delErr.message}`);
              } else {
                deleted = delData?.length ?? 0;
              }
            }

            if (mode === 'merge' && cleanRows.length > 0) {
              const dates = cleanRows.map(r => r.date as string);
              const { data: existing, error: existErr } = await supabase
                .from('training_plan')
                .select('date')
                .in('date', dates);
              
              if (existErr) {
                errors.push(`Query existing failed: ${existErr.message}`);
              } else if (existing) {
                overwritten = existing.length;
              }
            }

            if (errors.length === 0) {
              // Batch upsert in chunks of 50
              for (let i = 0; i < cleanRows.length; i += 50) {
                const chunk = cleanRows.slice(i, i + 50);
                if (chunk.length > 0) {
                  const { error, data } = await supabase
                    .from('training_plan')
                    .upsert(chunk, { onConflict: 'date' })
                    .select('id');
                  if (error) errors.push(error.message);
                  else imported += (data?.length ?? chunk.length);
                }
              }
            }
          } catch (err: any) {
            errors.push(err.message || String(err));
          } finally {
            resolve();
          }
        },
      });
    });

    const newAdded = mode === 'replace' ? imported : Math.max(0, imported - overwritten);

    setResult({ 
      imported, 
      overwritten: mode === 'replace' ? 0 : overwritten,
      newAdded,
      deleted: mode === 'replace' ? deleted : undefined, 
      errors: errors.slice(0, 5) 
    });
    setImporting(false);
    if (errors.length === 0) {
      setTimeout(onImported, 2500); // Give 2.5s for user to read the counts
    }
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet animate-slide-up" role="dialog" aria-modal aria-label="Import CSV">
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.25rem' }}>Import Training Plan</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            id="import-mode-replace"
            onClick={() => setMode('replace')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 10px',
              borderRadius: 14,
              border: `2px solid ${mode === 'replace' ? '#EF4444' : 'var(--color-border)'}`,
              background: mode === 'replace' ? 'rgba(239,68,68,0.08)' : 'var(--color-bg-elevated)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Trash size={20} color={mode === 'replace' ? '#EF4444' : 'var(--color-text-muted)'} weight={mode === 'replace' ? 'fill' : 'regular'} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: mode === 'replace' ? '#EF4444' : 'var(--color-text-muted)', fontFamily: "'Baloo 2', sans-serif" }}>
              Replace
            </span>
            <span style={{ fontSize: '0.6875rem', color: mode === 'replace' ? '#EF4444' : 'var(--color-text-subtle)', textAlign: 'center', lineHeight: 1.3 }}>
              ลบทุกอย่างก่อน แล้ว import ใหม่
            </span>
          </button>

          <button
            id="import-mode-merge"
            onClick={() => setMode('merge')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 10px',
              borderRadius: 14,
              border: `2px solid ${mode === 'merge' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: mode === 'merge' ? 'var(--color-primary-soft)' : 'var(--color-bg-elevated)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <ArrowsMerge size={20} color={mode === 'merge' ? 'var(--color-primary)' : 'var(--color-text-muted)'} weight={mode === 'merge' ? 'fill' : 'regular'} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: mode === 'merge' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontFamily: "'Baloo 2', sans-serif" }}>
              Smart Merge
            </span>
            <span style={{ fontSize: '0.6875rem', color: mode === 'merge' ? 'var(--color-primary)' : 'var(--color-text-subtle)', textAlign: 'center', lineHeight: 1.3 }}>
              วันที่ใน CSV แทนที่, วันอื่นๆ คงเดิม
            </span>
          </button>
        </div>

        {/* Warning for replace mode */}
        {mode === 'replace' && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            marginBottom: 16,
          }}>
            <Warning size={16} color="#EF4444" weight="fill" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '0.8125rem', color: '#EF4444', margin: 0, lineHeight: 1.4 }}>
              <strong>แผนซ้อมทั้งหมดจะถูกลบออก</strong> ก่อนที่ข้อมูลใน CSV จะถูก import เข้ามา ไม่สามารถกู้คืนได้
            </p>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 16,
            padding: 28,
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'var(--color-primary-soft)' : 'var(--color-bg-elevated)',
            transition: 'all 0.2s',
            marginBottom: 16,
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            aria-label="Upload CSV file"
          />
          <UploadSimple size={32} color={dragOver ? 'var(--color-primary)' : '#64748B'} style={{ margin: '0 auto 10px' }} />
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
            {file ? file.name : 'Drop CSV or tap to browse'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Columns: date, session_type, distance_km, pace_target, hr_zone, phase, description, notes
          </p>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p className="section-title">Preview ({preview.length} rows shown)</p>
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--color-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-elevated)' }}>
                    {['date', 'session_type', 'distance_km', 'pace_target', 'hr_zone'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border-muted)' }}>
                      {['date', 'session_type', 'distance_km', 'pace_target', 'hr_zone'].map((k) => (
                        <td key={k} style={{ padding: '8px 10px', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                          {(row as unknown as Record<string, string>)[k] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: result.errors.length === 0 ? 'rgba(5,150,105,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${result.errors.length === 0 ? 'rgba(5,150,105,0.25)' : 'rgba(239,68,68,0.25)'}`,
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {result.errors.length === 0
                ? <CheckCircle size={16} color="#059669" weight="fill" />
                : <Warning size={16} color="#EF4444" weight="fill" />}
              <span style={{ fontWeight: 600, color: result.errors.length === 0 ? '#059669' : '#EF4444', fontSize: '0.875rem' }}>
                นำเข้าสำเร็จทั้งหมด {result.imported} รายการ
              </span>
            </div>
            
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.deleted !== undefined && (
                <span>• ลบแผนซ้อมเดิมทั้งหมด: <strong>{result.deleted}</strong> รายการ</span>
              )}
              {result.newAdded > 0 && (
                <span>• เพิ่มแผนซ้อมใหม่: <strong>{result.newAdded}</strong> รายการ</span>
              )}
              {result.overwritten > 0 && (
                <span>• วันที่ซ้ำ/อัปเดตข้อมูลทับของเดิม: <strong>{result.overwritten}</strong> รายการ</span>
              )}
            </div>

            {result.errors.map((e, i) => (
              <p key={i} style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: 4 }}>{e}</p>
            ))}
          </div>
        )}

        <button
          className={`btn ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`}
          style={{ width: '100%' }}
          disabled={!file || importing}
          onClick={handleImport}
          id="import-confirm-btn"
        >
          {importing
            ? 'Importing…'
            : mode === 'replace'
              ? '⚠ Replace & Import'
              : 'Smart Merge & Import'}
        </button>
      </div>
    </div>
  );
}
