import { useState, useEffect } from 'react';
import { getMyTarget } from '../api/target';
import { SkeletonRow } from '../../../components/Skeleton';

export default function MyTarget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMyTarget()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonRow cols={3} height={100} />;
  if (!data) return <div className="empty-state"><p>Could not load target data.</p></div>;

  const { target, collected, remaining, target_source, salary, months_employed, stats } = data;
  const progress = target > 0 ? Math.min(100, (collected / target) * 100) : 0;

  const sourceLabel = {
    auto: 'Auto-calculated (based on salary & joining date)',
    manual: 'Set by Admin',
    not_set: 'Not set by Admin yet',
  };

  return (
    <div className="bento-grid">
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num">₹{Number(target || 0).toLocaleString('en-IN')}</div>
            <div className="m3-stat-lbl">Monthly Target</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num">₹{Number(collected || 0).toLocaleString('en-IN')}</div>
            <div className="m3-stat-lbl">Collected</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num">₹{Number(remaining || 0).toLocaleString('en-IN')}</div>
            <div className="m3-stat-lbl">Remaining</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num">{stats?.total || 0}</div>
            <div className="m3-stat-lbl">Assigned Donors</div>
          </div>
        </div>
      </div>

      <div className="bento-col-8">
        <div className="bento-card">
          <div className="bento-card-h">
            <h3>Progress</h3>
            <span style={{ fontSize:11, color:'var(--md-outline)' }}>{progress.toFixed(0)}% complete</span>
          </div>
          <div className="fro-progress" style={{ height:8 }}>
            <div className="fro-progress-fill" style={{ width:`${progress}%` }}></div>
          </div>
          <div style={{ marginTop:8, fontSize:10, color:'var(--md-outline)' }}>
            <strong>Source:</strong> {sourceLabel[target_source] || target_source}
          </div>
          {target_source === 'auto' && (
            <div style={{ marginTop:4, fontSize:10, color:'var(--md-outline)' }}>
              Salary: ₹{Number(salary || 0).toLocaleString('en-IN')} | Month {Math.min(months_employed + 1, 3)} of auto-calculation
            </div>
          )}
        </div>
      </div>

      <div className="bento-col-4">
        <div className="bento-card">
          <div className="bento-card-h"><h3>Status Breakdown</h3></div>
          <table className="bento-table">
            <thead>
              <tr><th>Status</th><th>Count</th></tr>
            </thead>
            <tbody>
              {stats && Object.entries(stats).filter(([k]) => k !== 'total').map(([status, count]) => (
                <tr key={status}>
                  <td style={{ textTransform:'capitalize' }}>{status.replace(/_/g, ' ')}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
