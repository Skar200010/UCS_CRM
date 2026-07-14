import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Upload, Download, CheckCircle, AlertCircle, Loader2, FileText, Copy } from 'lucide-react';
import Papa from 'papaparse';

interface UserImportRow {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: string;
}

interface CreatedUser {
  email: string;
  password: string;
}

interface ImportResult {
  created: number;
  failed: number;
  errors: string[];
  createdUsers: CreatedUser[];
}

export function BatchUserImport() {
  const [data, setData] = useState<UserImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const users: UserImportRow[] = rows.map((r) => ({
          email: r.email || r.Email || r.EMAIL || '',
          first_name: r.first_name || r['First Name'] || r.firstName || '',
          last_name: r.last_name || r['Last Name'] || r.lastName || '',
          phone: r.phone || r.Phone || r.PHONE || '',
          role: r.role || r.Role || 'agent',
        })).filter((u) => u.email);
        setData(users);
      },
      error: () => setError('Failed to parse CSV file'),
    });
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setImporting(true);
    setError(null);

    const errors: string[] = [];
    let created = 0;
    let failed = 0;
    const createdUsers: CreatedUser[] = [];

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setError('Not authenticated');
      setImporting(false);
      return;
    }

    for (const row of data) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(row),
          }
        );
        const result = await res.json();
        if (!res.ok) {
          errors.push(`${row.email}: ${result.error}`);
          failed++;
        } else {
          createdUsers.push({ email: row.email, password: result.tempPassword });
          created++;
        }
      } catch (e) {
        errors.push(`${row.email}: Unknown error`);
        failed++;
      }
    }

    setResult({ created, failed, errors, createdUsers });
    setImporting(false);
  };

  const downloadTemplate = () => {
    const csv = `email,first_name,last_name,phone,role
john@example.com,John,Smith,+1234567890,agent
jane@example.com,Jane,Doe,+9876543210,agent`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'telecaller_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Import Telecallers</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            Download Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border-2 border-dashed p-6 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="mb-1 text-sm font-medium">Upload CSV with telecaller data</p>
          <p className="mb-3 text-xs text-muted-foreground">
            CSV must have: <strong>email</strong>, <strong>first_name</strong>, <strong>last_name</strong>
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4" />
            Choose CSV
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {data.length > 0 && !result && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">{data.length} telecallers ready to import</p>
              <Button size="sm" onClick={() => setData([])}>Clear</Button>
            </div>
            <div className="max-h-40 overflow-y-auto text-sm">
              {data.slice(0, 15).map((u, i) => (
                <div key={i} className="flex items-center justify-between border-b py-1.5">
                  <span>{u.first_name} {u.last_name}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </div>
              ))}
              {data.length > 15 && <p className="pt-2 text-xs text-muted-foreground">...and {data.length - 15} more</p>}
            </div>
            <Button className="mt-3 w-full" onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {data.length} Telecallers
            </Button>
          </div>
        )}

        {result && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">{result.created} accounts created</span>
              {result.createdUsers.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => {
                  const csv = 'email,password\n' + result.createdUsers.map(u => `${u.email},${u.password}`).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'passwords.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="h-4 w-4" /> Export Passwords
                </Button>
              )}
            </div>
            {result.createdUsers.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">View passwords</summary>
                <div className="mt-2 max-h-40 overflow-y-auto border rounded">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-2 py-1 text-left">Email</th>
                        <th className="px-2 py-1 text-left">Password</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.createdUsers.map((u, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-2 py-1">{u.email}</td>
                          <td className="px-2 py-1 font-mono">{u.password}</td>
                          <td className="px-2 py-1">
                            <button onClick={() => { navigator.clipboard.writeText(u.password); }} className="text-primary hover:underline">
                              <Copy className="h-3 w-3 inline" /> Copy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            {result.failed > 0 && (
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm">{result.failed} failed</span>
              </div>
            )}
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">View errors</summary>
                <div className="mt-1 max-h-24 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
