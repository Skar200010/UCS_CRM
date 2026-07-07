import { CATEGORIES, EVENT_STATUSES, PRIORITIES } from '../../store'
import { Search, Funnel, X } from '../../icons'

const selectStyle = {
  padding: '7px 10px',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
  background: 'var(--card-bg)',
  color: 'var(--ink)',
  minWidth: 130,
  cursor: 'pointer',
  transition: 'border-color .15s',
}

const inputStyle = {
  ...selectStyle,
  minWidth: 180,
  cursor: 'text',
}

export default function PlannerFilters({
  search, onSearchChange,
  filterNgo, onNgoChange,
  filterCategory, onCategoryChange,
  filterStatus, onStatusChange,
  filterPriority, onPriorityChange,
  ngos,
  hasActiveFilters, onClear,
}) {
  return (
    <div className="card">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderBottom: '1px solid var(--line)',
        flexWrap: 'wrap',
      }}>
        <Funnel size={16} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginRight: 4 }}>Filters</span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30, width: '100%' }}
              onFocus={e => { e.target.style.borderColor = 'var(--sage)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)' }}
            />
          </div>

          <select value={filterNgo} onChange={e => onNgoChange(e.target.value)} style={selectStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--sage)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)' }}>
            <option value="">All NGOs</option>
            <option value="BSCT">BSCT</option>
            <option value="AFLF">AFLF</option>
            <option value="MANN">MANN</option>
            {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>

          <select value={filterCategory} onChange={e => onCategoryChange(e.target.value)} style={selectStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--sage)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)' }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={e => onStatusChange(e.target.value)} style={selectStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--sage)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)' }}>
            <option value="">All Status</option>
            {EVENT_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select value={filterPriority} onChange={e => onPriorityChange(e.target.value)} style={selectStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--sage)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--line)' }}>
            <option value="">All Priority</option>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>



          {hasActiveFilters && (
            <button
              onClick={onClear}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 12px',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--danger)',
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--danger)' }}
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
