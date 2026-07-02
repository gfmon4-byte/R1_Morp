'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, UploadSimple, FileText, CheckCircle, Warning } from '@phosphor-icons/react';
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

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export function CsvImport({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
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

    await new Promise<void>((resolve) => {
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data;
          // Batch into chunks of 50
          for (let i = 0; i < rows.length; i += 50) {
            const chunk = rows.slice(i, i + 50).map((row, idx) => {
              if (!row.date) {
                errors.push(`Row ${i + idx + 2}: missing date`);
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
            }).filter(Boolean);

            if (chunk.length > 0) {
              const { error, data } = await supabase
                .from('training_plan')
                .upsert(chunk as Record<string, unknown>[], { onConflict: 'date' })
                .select('id');
              if (error) errors.push(error.message);
              else imported += (data?.length ?? chunk.length);
            }
          }
          resolve();
        },
      });
    });

    setResult({ imported, errors: errors.slice(0, 5) });
    setImporting(false);
    if (errors.length === 0) {
      setTimeout(onImported, 1500);
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

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#EA580C' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 16,
            padding: 32,
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(234,88,12,0.06)' : 'var(--color-bg-elevated)',
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
          <UploadSimple size={36} color={dragOver ? '#EA580C' : '#64748B'} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
            {file ? file.name : 'Drop CSV or tap to browse'}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Expected columns: date, day_of_week, phase, session_type, description, distance_km, pace_target, hr_zone, rpe, notes
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
                {result.imported} rows imported
              </span>
            </div>
            {result.errors.map((e, i) => (
              <p key={i} style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: 4 }}>{e}</p>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={!file || importing}
          onClick={handleImport}
        >
          {importing ? 'Importing…' : 'Import Plan'}
        </button>
      </div>
    </div>
  );
}
