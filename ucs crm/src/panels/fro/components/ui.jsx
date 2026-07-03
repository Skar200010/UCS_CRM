import { useState, useRef, useEffect } from 'react';

export function DatePicker({ value, onChange, placeholder, min }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPicker = () => {
    if (value) {
      const p = value.split('-');
      setViewDate(new Date(+p[0], +p[1] - 1, 1));
    }
    setViewMode('month');
    setOpen(true);
  };

  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : (placeholder || '');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const yearStart = year - 6;
  const yearEnd = year + 7;
  const yearCells = [];
  for (let y = yearStart; y <= yearEnd; y++) {
    const yCls = (y === year ? ' selected' : '') + (y === today.getFullYear() ? ' today' : '');
    yearCells.push(
      <div key={y} className={`dp-year${yCls}`}
        onClick={() => { setViewDate(new Date(y, month, 1)); setViewMode('month'); }}>
        {y}
      </div>
    );
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const disabled = min && dateStr < min;
    const cls = (dateStr === value ? ' selected' : '') + (dateStr === todayStr ? ' today' : '') + (disabled ? ' disabled' : '');
    cells.push(
      <div key={d} className={`dp-day${cls}`}
        onClick={() => { if (!disabled) { onChange?.({ target: { value: dateStr } }); setOpen(false); } }}>
        {d}
      </div>
    );
  }

  return (
    <div ref={ref} className="datepicker">
      <button className="dp-trigger" type="button" onClick={openPicker}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span style={{ opacity: display ? 1 : 0.55 }}>{display || placeholder}</span>
      </button>
      {open && (
        <div className="dp-popup">
          <div className="dp-header">
            {viewMode === 'month' ? (
              <>
                <button className="dp-nav" type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}>&lsaquo;</button>
                <button className="dp-title-btn" type="button" onClick={() => setViewMode('year')}>{monthNames[month]} {year}</button>
                <button className="dp-nav" type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}>&rsaquo;</button>
              </>
            ) : (
              <>
                <button className="dp-nav" type="button" onClick={() => setViewDate(new Date(year - 14, month, 1))}>&laquo;</button>
                <span className="dp-title">{yearStart} &ndash; {yearEnd}</span>
                <button className="dp-nav" type="button" onClick={() => setViewDate(new Date(year + 14, month, 1))}>&raquo;</button>
              </>
            )}
          </div>
          {viewMode === 'month' ? (
            <>
              <div className="dp-weekdays">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="dp-wd">{d}</div>)}
              </div>
              <div className="dp-grid">{cells}</div>
            </>
          ) : (
            <div className="dp-year-grid">{yearCells}</div>
          )}
        </div>
      )}
    </div>
  );
}
