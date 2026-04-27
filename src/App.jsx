import { useEffect, useMemo, useState } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { supabase } from './lib/supabaseClient'
import './App.css'

const THURSDAY_OPTIONS = ['Called', 'Left Message', 'No Answer']
const FRIDAY_OPTIONS = [
  'Regular Meds',
  'Narcotics',
  'Fridge Items',
  'Central Fill',
  'Antibiotic/Waiters',
]

const THURSDAY_COLORS = ['#7dd3fc', '#f97316', '#8b5cf6']
const FRIDAY_COLORS = ['#ef4444', '#22c55e', '#06b6d4', '#f59e0b', '#a855f7']

const DEFAULT_DATA = {
  theme: 'dark',
  notes: '',
  thursday: {
    counts: {
      Called: 0,
      'Left Message': 0,
      'No Answer': 0,
    },
    selected: 'Called',
  },
  friday: {
    counts: {
      'Regular Meds': 0,
      Narcotics: 0,
      'Fridge Items': 0,
      'Central Fill': 0,
      'Antibiotic/Waiters': 0,
    },
    selected: 'Regular Meds',
  },
  log: [],
}

function toPieData(counts) {
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

function totalFromCounts(counts) {
  return Object.values(counts).reduce((sum, value) => sum + value, 0)
}

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [state, setState] = useState(() => {
    const stored = window.localStorage.getItem('rx-tracker-state')
    return stored ? JSON.parse(stored) : DEFAULT_DATA
  })
  const [cloudMessage, setCloudMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1800)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('rx-tracker-state', JSON.stringify(state))
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state])

  useEffect(() => {
    async function loadCloudData() {
      if (!supabase) {
        setCloudMessage('Cloud sync disabled (Supabase env missing).')
        return
      }

      const { data, error } = await supabase
        .from('tracker_state')
        .select('payload')
        .eq('id', 1)
        .maybeSingle()

      if (error) {
        setCloudMessage('Cloud read failed, using local data.')
        return
      }

      if (data?.payload) {
        setState((current) => ({ ...current, ...data.payload }))
        setCloudMessage('Cloud data loaded.')
      }
    }

    loadCloudData()
  }, [])

  const thursdayData = useMemo(() => toPieData(state.thursday.counts), [state])
  const fridayData = useMemo(() => toPieData(state.friday.counts), [state])

  const totalCalls = totalFromCounts(state.thursday.counts)
  const totalCancelled = totalFromCounts(state.friday.counts)

  function toggleTheme() {
    setState((current) => ({
      ...current,
      theme: current.theme === 'dark' ? 'light' : 'dark',
    }))
  }

  function adjustCount(day, label, delta) {
    setState((current) => {
      const previous = current[day].counts[label]
      const nextValue = Math.max(0, previous + delta)
      if (nextValue === previous) return current

      const nextLog =
        delta > 0
          ? [
              {
                id: crypto.randomUUID(),
                day,
                label,
                timestamp: new Date().toISOString(),
              },
              ...current.log,
            ]
          : current.log

      return {
        ...current,
        [day]: {
          ...current[day],
          counts: {
            ...current[day].counts,
            [label]: nextValue,
          },
        },
        log: nextLog,
      }
    })
  }

  function removeLog(id) {
    setState((current) => {
      const entry = current.log.find((item) => item.id === id)
      if (!entry) return current
      const previous = current[entry.day].counts[entry.label]
      if (previous <= 0) {
        return { ...current, log: current.log.filter((item) => item.id !== id) }
      }

      return {
        ...current,
        [entry.day]: {
          ...current[entry.day],
          counts: {
            ...current[entry.day].counts,
            [entry.label]: previous - 1,
          },
        },
        log: current.log.filter((item) => item.id !== id),
      }
    })
  }

  function clearAll() {
    setState((current) => ({
      ...DEFAULT_DATA,
      theme: current.theme,
    }))
  }

  function updateSelected(day, value) {
    setState((current) => ({
      ...current,
      [day]: {
        ...current[day],
        selected: value,
      },
    }))
  }

  async function saveToCloud() {
    if (!supabase) {
      setCloudMessage('Add Supabase env vars to enable cloud save.')
      return
    }

    const { error } = await supabase.from('tracker_state').upsert(
      {
        id: 1,
        payload: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    setCloudMessage(error ? 'Cloud save failed.' : 'Saved to Supabase.')
  }

  if (showSplash) {
    return (
      <section className="splash-screen">
        <div className="splash-glow" />
        <h1>RX Tracker</h1>
        <p>PlayStation-inspired workflow for fast pharmacy RTS tracking.</p>
        <button type="button" className="primary-btn" onClick={() => setShowSplash(false)}>
          Enter Tracker
        </button>
      </section>
    )
  }

  return (
    <main className="app-shell">
      <header className="top-nav">
        <h1 className="brand">RX Tracker</h1>
        <div className="social-corner">
          <a href="https://github.com/kashkigan/rts-tracker" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href="https://www.linkedin.com/in/kiranpal-gandhi" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
        <nav>
          {['Dashboard', 'Statistics', 'Notes'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`nav-btn ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'Dashboard' ? '🕹️' : tab === 'Statistics' ? '📊' : '📝'} {tab}
            </button>
          ))}
        </nav>
        <button type="button" className="theme-btn" onClick={toggleTheme}>
          {state.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </header>
      <div className="cloud-row">
        <button type="button" className="ghost-btn" onClick={saveToCloud}>
          Save to Cloud
        </button>
        <span>{cloudMessage}</span>
      </div>

      {activeTab === 'Dashboard' && (
        <section className="dashboard-grid">
          <div className="panel">
            <h2>Thursday Calls</h2>
            <p>Total: {totalCalls}</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={thursdayData} dataKey="value" nameKey="name" outerRadius={95}>
                    {thursdayData.map((entry, index) => (
                      <Cell key={entry.name} fill={THURSDAY_COLORS[index % THURSDAY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="logger">
              <select
                value={state.thursday.selected}
                onChange={(event) => updateSelected('thursday', event.target.value)}
              >
                {THURSDAY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary-btn"
                onClick={() => adjustCount('thursday', state.thursday.selected, 1)}
              >
                + Log
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => adjustCount('thursday', state.thursday.selected, -1)}
              >
                - Remove
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>Friday Cancelled</h2>
            <p>Total: {totalCancelled}</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={fridayData} dataKey="value" nameKey="name" outerRadius={95}>
                    {fridayData.map((entry, index) => (
                      <Cell key={entry.name} fill={FRIDAY_COLORS[index % FRIDAY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="logger">
              <select
                value={state.friday.selected}
                onChange={(event) => updateSelected('friday', event.target.value)}
              >
                {FRIDAY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="primary-btn"
                onClick={() => adjustCount('friday', state.friday.selected, 1)}
              >
                + Log
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => adjustCount('friday', state.friday.selected, -1)}
              >
                - Remove
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'Statistics' && (
        <section className="panel">
          <div className="stats-row">
            <div>
              <h2>Quick Stats</h2>
              <p>Thursday logged calls: {totalCalls}</p>
              <p>Friday cancelled meds: {totalCancelled}</p>
              <p>Total actions: {state.log.length}</p>
            </div>
            <button type="button" className="danger-btn" onClick={clearAll}>
              Reset All Counts
            </button>
          </div>
          <h3>Recent Entries (click delete to undo)</h3>
          <ul className="history-list">
            {state.log.length === 0 && <li>No entries yet.</li>}
            {state.log.map((entry) => (
              <li key={entry.id}>
                <span>
                  {entry.day === 'thursday' ? 'Thursday' : 'Friday'} - {entry.label}
                </span>
                <button type="button" className="ghost-btn" onClick={() => removeLog(entry.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'Notes' && (
        <section className="panel">
          <h2>Humanized Notes</h2>
          <p>Save reminders, context, and handoff notes for your shift.</p>
          <textarea
            value={state.notes}
            onChange={(event) =>
              setState((current) => ({ ...current, notes: event.target.value }))
            }
            rows={10}
            placeholder="Example: Called Mrs. Diaz, left voicemail at 4:15 PM..."
          />
        </section>
      )}
      <footer className="app-footer">
        <div>
          <a href="https://github.com/kashkigan/rts-tracker" target="_blank" rel="noreferrer">
            GitHub Repo
          </a>
          {' | '}
          <a href="https://www.linkedin.com/in/kiranpal-gandhi" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
        <p>Made by Kiranpal Gandhi 2026</p>
      </footer>
    </main>
  )
}

export default App
