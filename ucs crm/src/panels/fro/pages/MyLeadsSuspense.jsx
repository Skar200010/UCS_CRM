import { useRef } from 'react';
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
  const shellRef = useRef(null);

  // On phones the split is stacked, so chrome (padding/gap) must shrink to
  // leave as much height as possible for the two scrollable lists.
  const gap = isCompact ? 8 : isMobile ? 10 : 12;
  const pad = isCompact ? 6 : isMobile ? 8 : 12;
  const leadFlex = isMobile ? '1 1 50%' : '3 1 0';
  const suspFlex = isMobile ? '1 1 50%' : '2 1 0';

return (
    <div ref={shellRef} className="my-leads-shell" style={{ height: '100%', position: 'relative', display: 'flex', gap, padding: pad, boxSizing: 'border-box', minHeight: 0 }}>
      <div style={{
        flex: leadFlex,
        minWidth: 0, minHeight: 0,
        position: 'relative',
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <SectionTitle label="My Leads" pct="60%" />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <MyDonors embedded portalEl={shellRef.current} />
        </div>
      </div>

      <div style={{
        flex: suspFlex,
        minWidth: 0, minHeight: 0,
        position: 'relative',
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

      <style>{`
        .my-leads-shell { container-type: inline-size; container-name: my-leads; }

        /* Base layout: two usable panes on wide screens. */
        .my-leads-shell > div { min-width: 0; }

        /* Use the available content width, not the browser viewport. This is
           important when DevTools, a split window, or a tablet layout reduces
           the FRO content area while the viewport itself remains wide. */
        @container my-leads (max-width: 900px) {
          .my-leads-shell {
            flex-direction: column !important;
            overflow-y: auto;
            align-items: stretch;
          }

          .my-leads-shell > div {
            flex: 1 1 360px !important;
            width: 100%;
            max-width: none;
          }
        }

        @container my-leads (max-width: 520px) {
          .my-leads-shell { gap: 8px !important; padding: 6px !important; }
          .my-leads-shell > div { flex-basis: 340px !important; border-radius: 8px; }
        }
      `}</style>
    </div>
  );
}
