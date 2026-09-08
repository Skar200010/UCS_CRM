import { useIsMobile } from '../../../hooks/useIsMobile';
import MyDonors from './MyDonors';
import FroSuspense from './Suspense';

function SectionTitle({ label, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 34, borderBottom: '1px solid var(--line)', background: '#fbfcfb', flexShrink: 0 }}>
      <span style={{ width: 4, height: 12, borderRadius: 2, background: 'var(--sage)', display: 'inline-block' }} />
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: 'var(--line)' }}>{pct}</span>
    </div>
  );
}

export default function MyLeadsSuspense() {
  const isMobile = useIsMobile();
  const isCompact = useIsMobile(480);

  // On phones the split is stacked, so chrome (padding/gap) must shrink to
  // leave as much height as possible for the two scrollable lists.
  const gap = isCompact ? 8 : isMobile ? 10 : 12;
  const pad = isCompact ? 6 : isMobile ? 8 : 12;
  const leadFlex = isMobile ? '1 1 50%' : '3 1 0';
  const suspFlex = isMobile ? '1 1 50%' : '2 1 0';

  return (
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap, padding: pad, boxSizing: 'border-box', minHeight: 0 }}>
      <div style={{
        flex: leadFlex,
        minWidth: 0, minHeight: 0,
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <SectionTitle label="My Leads" pct="60%" />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <MyDonors embedded />
        </div>
      </div>

      <div style={{
        flex: suspFlex,
        minWidth: 0, minHeight: 0,
        background: '#f8fafc',
        border: '1px solid var(--line)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <SectionTitle label="Suspense" pct="40%" />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <FroSuspense />
        </div>
      </div>
    </div>
  );
}