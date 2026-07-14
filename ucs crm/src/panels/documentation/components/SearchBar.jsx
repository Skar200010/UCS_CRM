import { useDoc } from '../store'

export default function SearchBar() {
  const { searchQuery, setSearchQuery, searchResults, setActivePanel, setActiveScreen } = useDoc()

  return (
    <div className="doc-search-container">
      <input
        className="doc-search-input"
        type="text"
        placeholder="🔍 Search panels, APIs, features..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />
      {searchQuery.length >= 2 && (
        <div className="doc-search-results">
          {searchResults.length === 0 && (
            <div className="doc-search-empty">No results found</div>
          )}
          {searchResults.map((r, i) => (
            <div
              key={i}
              className="doc-search-item"
              onClick={() => {
                setActivePanel(r.panel)
                setActiveScreen(r.path)
                setSearchQuery('')
              }}
            >
              <span className={`doc-search-type ${r.type}`}>{r.type}</span>
              <span style={{ fontSize: 12 }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
