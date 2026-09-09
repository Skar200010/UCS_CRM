import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

// Renders the first slide of a .pptx to a PNG using LibreOffice headless.
// Returns a PNG buffer, or null when soffice is unavailable or rendering fails
// (the caller treats null as "no auto snapshot", never as an error).
export async function snapshotPptxToPng(buffer) {
  if (!buffer || !buffer.length) return null;
  const dir = mkdtempSync(path.join(tmpdir(), 'cert-slide-'));
  const src = path.join(dir, 'input.pptx');
  try {
    writeFileSync(src, buffer);
    let stdout = '';
    try {
      const res = await execFileAsync('soffice', ['--headless', '--convert-to', 'png', '--outdir', dir, src], { timeout: 60000 });
      stdout = res.stdout || '';
    } catch (e) {
      // soffice not installed on the host -> no auto snapshot, stay on manual upload.
      if (e.code === 'ENOENT') return null;
      // LibreOffice can still succeed despite a non-zero exit in some builds; verify output below.
      stdout = String(e.stdout || '');
    }
    const out = path.join(dir, 'input.png');
    if (!existsSync(out)) return null;
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}