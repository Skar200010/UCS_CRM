import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';

interface ContactImportRow {
  phone: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function ContactImportModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [data, setData] = useState<ContactImportRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setError(null);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setColumns(results.meta.fields || []);
        const rows = results.data as Record<string, string>[];
        const contacts: ContactImportRow[] = rows.map((r) => ({
          phone: (r.phone || r.Phone || r.PHONE || r['Phone Number'] || r.phone_number || '').replace(/\s+/g, ''),
          first_name: r.first_name || r['First Name'] || r.firstName || r.FirstName || '',
          last_name: r.last_name || r['Last Name'] || r.lastName || r.LastName || '',
          email: r.email || r.Email || r.EMAIL || '',
          company: r.company || r.Company || r.COMPANY || '',
        })).filter((c) => c.phone);
        setData(contacts);
      },
      error: () => {
        setError('Failed to parse CSV file. Make sure it\'s a valid CSV.');
      },
    });
  };

  const handleImport = async () => {
    if (!user || data.length === 0) return;
    setImporting(true);
    setError(null);

    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    for (const row of data) {
      try {
        const { error } = await supabase.from('contacts').upsert({
          tenant_id: user.tenant_id,
          phone: row.phone,
          phone_normalized: row.phone,
          first_name: row.first_name || null,
          last_name: row.last_name || null,
          email: row.email || null,
          company: row.company || null,
          source: 'import',
        }, { onConflict: 'tenant_id,phone_normalized', ignoreDuplicates: false });

        if (error) {
          errors.push(`${row.phone}: ${error.message}`);
          skipped++;
        } else {
          imported++;
        }
      } catch (e) {
        errors.push(`${row.phone}: Unknown error`);
        skipped++;
      }
    }

    setResult({ imported, skipped, errors });
    setImporting(false);
    if (imported > 0) onSuccess();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Import Contacts (CSV)</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          {!data.length && !result ? (
            <>
              <div className="rounded-lg border-2 border-dashed p-8 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 text-sm font-medium">
                  Drop a CSV file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  CSV must have at least a <strong>phone</strong> column
                </p>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <Upload className="h-4 w-4" />
                  Choose File
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onDrop([file]);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-lg bg-muted p-4 text-xs text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Expected CSV format:</p>
                <code className="block whitespace-pre">
                  phone,first_name,last_name,email,company{'\n'}
                  +1234567890,John,Doe,john@example.com,Acme Inc{'\n'}
                  +9876543210,Jane,Smith,jane@example.com,Beta Corp
                </code>
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </>
          ) : result ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Import Results</h3>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>{result.imported} contacts imported successfully</span>
                </div>
                {result.skipped > 0 && (
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span>{result.skipped} contacts skipped</span>
                  </div>
                )}
                {result.errors.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground">View errors ({result.errors.length})</summary>
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive">{err}</p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <Button className="w-full" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Preview ({data.length} rows)</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setData([]); setColumns([]); }}
                  >
                    <X className="h-3 w-3" />
                    Reset
                  </Button>
                </div>
                <div className="mt-3 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {columns.slice(0, 5).map((col) => (
                          <th key={col} className="pb-1 pr-2 text-left font-medium text-muted-foreground">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-1 pr-2">{row.phone}</td>
                          <td className="py-1 pr-2">{row.first_name}</td>
                          <td className="py-1 pr-2">{row.last_name}</td>
                          <td className="py-1 pr-2">{row.email}</td>
                          <td className="py-1 pr-2">{row.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.length > 10 && (
                    <p className="mt-2 text-xs text-muted-foreground">...and {data.length - 10} more rows</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setData([]); setColumns([]); }}>Cancel</Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import {data.length} Contacts
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
