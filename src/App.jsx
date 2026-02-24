import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [namespaces, setNamespaces] = useState([])
  const [recentDocs, setRecentDocs] = useState([])
  const [stats, setStats] = useState({ total_documents: 0, vectorized: 0 })
  const [selectedNamespace, setSelectedNamespace] = useState('')
  const [filterNamespace, setFilterNamespace] = useState(null)
  const [text, setText] = useState('')
  const [newNamespace, setNewNamespace] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(async () => {
    try {
      const [nsRes, statsRes, recentRes] = await Promise.all([
        fetch(`${API_URL}/namespaces`),
        fetch(`${API_URL}/stats`),
        fetch(`${API_URL}/recent?limit=10${filterNamespace ? `&namespace=${filterNamespace}` : ''}`)
      ])
      const nsData = await nsRes.json()
      const statsData = await statsRes.json()
      const recentData = await recentRes.json()
      
      setNamespaces(nsData.namespaces || [])
      setStats(statsData)
      setRecentDocs(recentData.documents || [])
      
      if (!selectedNamespace && nsData.namespaces?.length > 0) {
        setSelectedNamespace(nsData.namespaces[0].name)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    }
  }, [filterNamespace, selectedNamespace])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleIngest = async (e) => {
    e.preventDefault()
    const ns = newNamespace.trim() || selectedNamespace
    if (!ns || !text.trim()) {
      showToast('Namespace and text are required', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace: ns, text: text.trim() })
      })
      const data = await res.json()
      
      if (res.ok) {
        showToast(`✓ Ingested into "${ns}" — now queryable by the AI agent`)
        setText('')
        setNewNamespace('')
        fetchData()
      } else {
        showToast(data.detail || 'Ingestion failed', 'error')
      }
    } catch (err) {
      showToast('Network error — is the backend running?', 'error')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const d = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header__icon">🧠</div>
        <h1 className="header__title">Elastic Dreamer</h1>
        <p className="header__subtitle">
          Ingest knowledge into the graph. The AI agent in Kibana can immediately query anything you add here.
        </p>
      </header>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-card__value">{stats.total_documents || 0}</div>
          <div className="stat-card__label">Total Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats.vectorized || 0}</div>
          <div className="stat-card__label">Vectorized</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{namespaces.length}</div>
          <div className="stat-card__label">Namespaces</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">3072</div>
          <div className="stat-card__label">Vector Dims</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="main-grid">
        {/* Ingest Form */}
        <div className="card">
          <div className="card__header">
            <span className="card__icon">📥</span>
            <h2 className="card__title">Ingest Knowledge</h2>
          </div>
          
          <form onSubmit={handleIngest}>
            <div className="form-group">
              <label>Namespace</label>
              <select 
                value={selectedNamespace} 
                onChange={(e) => setSelectedNamespace(e.target.value)}
              >
                <option value="">Select a namespace...</option>
                {namespaces.map(ns => (
                  <option key={ns.name} value={ns.name}>
                    {ns.name} ({ns.count} docs)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Or create new namespace</label>
              <input
                type="text"
                placeholder="e.g. Project_Gamma"
                value={newNamespace}
                onChange={(e) => setNewNamespace(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Knowledge to ingest</label>
              <textarea
                placeholder="Paste any text here — meeting notes, architecture decisions, credentials, team info, incident reports..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={5000}
              />
              <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {text.length}/5000
              </div>
            </div>

            <button 
              type="submit" 
              className={`btn btn--primary ${loading ? 'btn--loading' : ''}`}
              disabled={loading || (!selectedNamespace && !newNamespace.trim()) || !text.trim()}
            >
              {loading ? '⏳ Vectorizing with Gemini...' : '🚀 Ingest & Vectorize'}
            </button>
          </form>
        </div>

        {/* Recent Documents */}
        <div className="card">
          <div className="card__header">
            <span className="card__icon">📄</span>
            <h2 className="card__title">Recent Documents</h2>
          </div>

          <div className="namespace-pills">
            <button 
              className={`namespace-pill ${!filterNamespace ? 'namespace-pill--active' : ''}`}
              onClick={() => setFilterNamespace(null)}
            >
              All
            </button>
            {namespaces.map(ns => (
              <button
                key={ns.name}
                className={`namespace-pill ${filterNamespace === ns.name ? 'namespace-pill--active' : ''}`}
                onClick={() => setFilterNamespace(filterNamespace === ns.name ? null : ns.name)}
              >
                {ns.name}
              </button>
            ))}
          </div>

          <div className="doc-list">
            {recentDocs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📭</div>
                <p>No documents yet. Ingest some knowledge!</p>
              </div>
            ) : (
              recentDocs.map((doc, i) => (
                <div key={i} className="doc-item">
                  <div className="doc-item__header">
                    <span className="doc-item__namespace">{doc.namespace}</span>
                    <span className="doc-item__type">
                      {doc.doc_type} · {formatTime(doc.timestamp)}
                    </span>
                  </div>
                  {doc.doc_type === 'triplet' ? (
                    <div className="doc-item__triplet">
                      <span>{doc.head}</span> → {doc.relation} → <span>{doc.tail}</span>
                    </div>
                  ) : (
                    <div className="doc-item__content">{doc.content}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
