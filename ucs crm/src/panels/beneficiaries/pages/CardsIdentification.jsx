import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '../store'

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', overflow: 'hidden' },
  cardPadding: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '20px', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--bg)', color: 'var(--ink)' },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--ink)' },
  link: { color: 'var(--sage)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 },
}

const CARD_STATUS_COLORS = {
  ACTIVE: ['#dcfce7', '#166534'],
  BLOCKED: ['#fee2e2', '#991b1b'],
  EXPIRED: ['#fef3c7', '#92400e'],
  REPLACED: ['#dbeafe', '#1e40af'],
}

export default function CardsIdentification() {
  const [search, setSearch] = useState('')
  const [beneficiary, setBeneficiary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [issuing, setIssuing] = useState(false)

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const result = await apiGet(`/beneficiaries?search=${encodeURIComponent(search)}&pageSize=1`)
      const b = result.data?.[0] || null
      if (b) {
        const detail = await apiGet(`/beneficiaries/${b.id}`)
        setBeneficiary(detail)
      } else {
        setBeneficiary(null)
      }
    } catch (e) {
      console.error('Search failed:', e)
      setBeneficiary(null)
    } finally {
      setLoading(false)
    }
  }

  const handleIssueCard = async () => {
    if (!beneficiary) return
    setIssuing(true)
    try {
      await apiPost(`/beneficiaries/${beneficiary.id}/cards`, {})
      const detail = await apiGet(`/beneficiaries/${beneficiary.id}`)
      setBeneficiary(detail)
    } catch (e) {
      alert('Failed to issue card: ' + (e.message || 'Unknown error'))
    } finally {
      setIssuing(false)
    }
  }

  const cards = beneficiary?.cards || []
  const activeCard = beneficiary?.activeCard

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Cards & Identification</h2>
      </div>

      <div style={styles.cardPadding}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>Search Beneficiary</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search by code, name, or mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ ...styles.input, flex: 1 }}
          />
          <button onClick={handleSearch} disabled={loading} style={{ ...styles.btn, background: 'var(--sage)', color: '#fff', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {searched && !loading && !beneficiary && (
        <div style={{ ...styles.cardPadding, textAlign: 'center', color: 'var(--ink-soft)' }}>
          No beneficiary found matching "{search}"
        </div>
      )}

      {beneficiary && (
        <div>
          <div style={styles.cardPadding}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{beneficiary.full_name}</h3>
                <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '4px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{beneficiary.beneficiary_code}</code>
                  <span>{beneficiary.mobile}</span>
                </div>
              </div>
              <button
                onClick={handleIssueCard}
                disabled={issuing}
                style={{ ...styles.btn, background: 'var(--sage)', color: '#fff', opacity: issuing ? 0.5 : 1 }}
              >
                {issuing ? 'Issuing...' : '+ Issue New Card'}
              </button>
            </div>

            {activeCard && (
              <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: 'var(--radius)', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Card</div>
                <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                  <div><strong>Card #:</strong> {activeCard.card_number}</div>
                  <div><strong>Token:</strong> {activeCard.qr_token?.slice(0, 12)}...</div>
                  <div><strong>Issued:</strong> {activeCard.issued_at || activeCard.created_at}</div>
                </div>
              </div>
            )}
          </div>

          <div style={styles.card}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>All Cards</h3>
            </div>
            {cards.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>No cards issued</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Card Number</th>
                    <th style={styles.th}>QR Token</th>
                    <th style={styles.th}>Issued</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c) => {
                    const [bg, fg] = CARD_STATUS_COLORS[c.status] || ['var(--bg)', 'var(--ink-soft)']
                    return (
                      <tr key={c.id}>
                        <td style={styles.td}><code style={{ fontSize: '12px', background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{c.card_number}</code></td>
                        <td style={styles.td}><code style={{ fontSize: '11px' }}>{c.qr_token?.slice(0, 16)}...</code></td>
                        <td style={styles.td}>{c.issued_at || c.created_at || '-'}</td>
                        <td style={styles.td}><span style={styles.pill(bg, fg)}>{c.status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
