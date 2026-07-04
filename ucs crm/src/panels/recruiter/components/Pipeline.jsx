import { useState } from 'react';
import { useRec, initials, avatarColor, avatarTint, STAGES } from '../store';

const STAGE_META = {
  'Contacted': { color: '#4F6472', light: '#E8EDF0', border: '#4F6472' },
  'Screening': { color: '#B5603A', light: '#F4E4DA', border: '#B5603A' },
  'Interview Scheduled': { color: '#C08A2E', light: '#F6EAD0', border: '#C08A2E' },
  'Selected': { color: '#5B6B4E', light: '#E8EDE1', border: '#5B6B4E' },
  'Offer Sent': { color: '#3B6B8A', light: '#E1EBF2', border: '#3B6B8A' },
  'Rejected': { color: '#9E3B2E', light: '#F3DDD8', border: '#9E3B2E' },
};

function ArrowRight() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function PipelineCard({ candidate, onDragStart, onDragEnd }) {
  const c = candidate;
  const init = initials(c.name);
  const col = avatarColor(c.name);
  const scoreCls = c.score >= 85 ? 'score-hi' : c.score >= 75 ? 'score-mid' : 'score-lo';

  return (
    <div className="pcard" draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}>
      <div className="pcard-top">
        <div className="pcard-avatar" style={{ background: avatarTint(col), color: col }}>
          {init}
        </div>
        <div className="pcard-info">
          <div className="pcard-name">{c.name}</div>
          <div className="pcard-role">{c.role}</div>
        </div>
        <div className={`pcard-badge ${scoreCls}`}>{c.score}</div>
      </div>
      <div className="pcard-skills">
        {c.skills.slice(0, 3).map(s => (
          <span key={s} className="pcard-skill">{s}</span>
        ))}
      </div>
      <div className="pcard-meta">
        <span className="pcard-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {c.source}
        </span>
        <span className="pcard-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c-4-3-8-6-8-11a8 8 0 0 1 16 0c0 5-4 8-8 11z"/><circle cx="12" cy="9" r="2.5"/></svg>
          {c.location}
        </span>
        <span className="pcard-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          {c.exp}
        </span>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { candidates, moveCandidate } = useRec();
  const [drag, setDrag] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const active = candidates.filter(c => c.stage !== 'Rejected').length;
  const rejected = candidates.filter(c => c.stage === 'Rejected').length;

  return (
    <div className="pipeline-page">
      <div className="pipeline-top">
        <div className="pipeline-top-left">
          <h2 className="pipeline-title">Hiring Pipeline</h2>
          <div className="pipeline-workspace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
            <span>Recruitment Workspace</span>
          </div>
        </div>
        <div className="pipeline-top-right">
          <div className="pipeline-counter active">
            <span className="pipeline-counter-dot" style={{ background: '#5B6B4E' }} />
            <span className="pipeline-counter-label">Active</span>
            <span className="pipeline-counter-num">{active}</span>
          </div>
          <div className="pipeline-counter rejected">
            <span className="pipeline-counter-dot" style={{ background: '#9E3B2E' }} />
            <span className="pipeline-counter-label">Rejected</span>
            <span className="pipeline-counter-num">{rejected}</span>
          </div>
        </div>
      </div>

      <div className="pipeline">
        {STAGES.flatMap((stage, i) => {
          const list = candidates.filter(c => c.stage === stage);
          const meta = STAGE_META[stage] || { color: 'var(--ink-soft)', light: 'var(--sand)', border: 'var(--line)' };
          const isDragOver = dragOver === stage;
          const items = [
            <div className="pcol-wrap" key={stage}>
              <div className={`pcol ${isDragOver ? 'drag-over' : ''}`}
                style={{ borderTopColor: meta.color, borderTopWidth: 3 }}
                onDragOver={e => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { if (drag != null) { moveCandidate(drag, stage); setDrag(null); setDragOver(null); } }}>
                <div className="pcol-head" style={{ background: meta.light }}>
                  <div className="pcol-head-left">
                    <span className="pcol-head-dot" style={{ background: meta.color }} />
                    <span className="pcol-head-label" style={{ color: meta.color }}>{stage}</span>
                  </div>
                  <span className="pcol-head-count" style={{ background: meta.color, color: '#fff' }}>{list.length}</span>
                </div>
                <div className="pcol-body">
                  {list.length === 0 ? (
                    <div className="pcol-empty">No candidates</div>
                  ) : (
                    list.map(c => (
                      <PipelineCard key={c.id} candidate={c} onDragStart={() => setDrag(c.id)} onDragEnd={() => setDrag(null)} />
                    ))
                  )}
                </div>
              </div>
            </div>
          ];
          if (i < STAGES.length - 1) {
            items.push(
              <div className="pipeline-connector" key={`conn-${stage}`}>
                <ArrowRight />
              </div>
            );
          }
          return items;
        })}
      </div>
    </div>
  );
}
