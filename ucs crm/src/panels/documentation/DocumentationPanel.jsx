import { DocProvider, useDoc } from './store'
import DocSidebar from './components/DocSidebar'
import SearchBar from './components/SearchBar'
import ScreenDetail from './components/ScreenDetail'
import PanelInfoCard from './components/PanelInfoCard'
import { useUcs } from '../../store'
import { useNavigate } from 'react-router-dom'

function DocContent() {
  const { currentPanel, activeScreen, setActiveScreen } = useDoc()
  if (!currentPanel) return <div className="doc-empty">Select a panel from the sidebar</div>

  return (
    <div className="doc-content">
      <PanelInfoCard panel={currentPanel} />

      {/* Screen selector tabs */}
      {currentPanel.screens?.length > 0 && (
        <div className="doc-screen-tabs">
          {currentPanel.screens.map(s => (
            <div
              key={s.path || s.name}
              className={`doc-screen-tab ${activeScreen === (s.path || s.name) ? 'active' : ''}`}
              onClick={() => setActiveScreen(activeScreen === (s.path || s.name) ? null : (s.path || s.name))}
            >
              {s.name}
            </div>
          ))}
        </div>
      )}

      {/* Active screens */}
      <div style={{ marginTop: 12 }}>
        {currentPanel.screens?.map(s => {
          const screenKey = s.path || s.name
          if (activeScreen && activeScreen !== screenKey) return null
          return <ScreenDetail key={screenKey} screen={s} panelId={currentPanel.id} />
        })}
      </div>
    </div>
  )
}

export default function DocumentationPanel() {
  const { user, logout } = useUcs()
  const navigate = useNavigate()

  return (
    <DocProvider>
      <div className="panel-documentation" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F8FAFC' }}>
        {/* Top Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '8px 20px',
          backgroundColor: '#1E3A5F', color: '#FFF', gap: 16, flexShrink: 0
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Calibri Light, sans-serif' }}>📖 UCS CRM Documentation</span>
          <div style={{ flex: 1, maxWidth: 400 }}>
            <SearchBar />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span>{user?.name || user?.email}</span>
            <button
              onClick={() => { logout(); navigate('/login') }}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#FFF',
                padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <DocSidebar />
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            <DocContent />
          </div>
        </div>
      </div>
    </DocProvider>
  )
}
