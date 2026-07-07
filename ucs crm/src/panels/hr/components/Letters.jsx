import { useState, useEffect } from 'react';
import { useHR } from '../store';
import { Dropdown } from './ui';
import { FileTxt, Download } from '../icons';
const BASE = import.meta.env.VITE_API_URL || 'https://ucs-crm-backend.vercel.app/api';

const HIDDEN_VARS = ['employee_name', 'candidate_name', 'company_name'];

export default function Letters() {
  const { fetchWorkers, fetchTemplates, generateLetter } = useHR();
  const [workers, setWorkers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [workerId, setWorkerId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [variables, setVariables] = useState({});
  const [generatedId, setGeneratedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWorkers().then(setWorkers).catch(() => {});
    fetchTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    const w = workers.find(x => x.id === workerId);
    if (!w) return;
    setVariables(prev => ({ ...prev, employee_name: w.name, candidate_name: w.name }));
  }, [workerId, workers]);

  const selectedTemplate = templates.find(t => t.id === templateId);
  const editableVars = (selectedTemplate?.variables || []).filter(v => !HIDDEN_VARS.includes(v));

  const generate = async () => {
    if (!templateId || !workerId) return;
    setLoading(true);
    setError('');
    setGeneratedId(null);
    try {
      const res = await generateLetter(templateId, workerId, variables);
      setGeneratedId(res.letter.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadUrl = generatedId ? `${BASE}/letters/generated/${generatedId}/download` : null;

  return (
    <div className="card">
      <div className="card-head"><h3>Generate Professional Letter</h3><span className="sub">select template &amp; fill details</span></div>
      <div className="card-pad">
        <div className="form-row">
          <label className="field">Worker
            <Dropdown value={workerId} onChange={e => setWorkerId(e.target.value)}
              options={workers.map(w => ({ value: w.id, label: w.name }))} />
          </label>
          <label className="field">Letter type
            <Dropdown value={templateId} onChange={e => { setTemplateId(e.target.value); setGeneratedId(null); }}
              options={templates.map(t => ({ value: t.id, label: t.title }))} />
          </label>
        </div>

        {editableVars.length > 0 && (
          <div className="form-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {editableVars.map(v => (
              <label key={v} className="field" style={{ minWidth: 160, flex: '1 0 auto' }}>
                {v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                <input type="text" value={variables[v] || ''}
                  onChange={e => setVariables(prev => ({ ...prev, [v]: e.target.value }))}
                  placeholder={'Enter ' + v.replace(/_/g, ' ')} />
              </label>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            <FileTxt width={16} /> {loading ? 'Generating...' : 'Generate Letter'}
          </button>
          {downloadUrl && (
            <a className="btn btn-success" href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download width={16} /> Download PDF
            </a>
          )}
        </div>

        {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}

        {generatedId && (
          <div className="letter" style={{ marginTop: 16 }}>
            <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>
              Letter generated successfully!
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              The letter has been saved and is ready to download. You can also view it later from the employee's profile.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
