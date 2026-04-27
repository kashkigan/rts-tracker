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
  currentWeekStart: '',
  weeks: {},
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekStartFrom(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + diff)
  return d
}

function getWeekRangeLabel(weekKey) {
  const start = new Date(`${weekKey}T00:00:00`)
  const end = addDays(start, 20)
  const format = (date) =>
    date.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    })
  return `${format(start)} - ${format(end)}`
}

function makeEmptyWeek() {
  return {
    thursdaySelected: THURSDAY_OPTIONS[0],
    fridaySelected: FRIDAY_OPTIONS[0],
    entries: [],
  }
}

function toPieData(entries, kind, options) {
  const counts = Object.fromEntries(options.map((item) => [item, 0]))
  for (const entry of entries) {
    if (entry.kind === kind) counts[entry.label] += 1
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [state, setState] = useState(() => {
    const stored = window.localStorage.getItem('rx-tracker-state')
    if (stored) return JSON.parse(stored)
    const initialWeek = toDateKey(weekStartFrom(new Date()))
    return {
      ...DEFAULT_DATA,
      currentWeekStart: initialWeek,
      weeks: {
        [initialWeek]: makeEmptyWeek(),
      },
    }
  })
  const [cloudMessage, setCloudMessage] = useState('')

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
        const next = data.payload
        if (!next.currentWeekStart) return
        setState(next)
        setCloudMessage('Cloud data loaded.')
      }
    }

    loadCloudData()
  }, [])

  const currentWeek = state.weeks[state.currentWeekStart] ?? makeEmptyWeek()
  const thursdayData = useMemo(
    () => toPieData(currentWeek.entries, 'thursday', THURSDAY_OPTIONS),
    [currentWeek.entries],
  )
  const fridayData = useMemo(
    () => toPieData(currentWeek.entries, 'friday', FRIDAY_OPTIONS),
    [currentWeek.entries],
  )
  const totalCalls = thursdayData.reduce((sum, item) => sum + item.value, 0)
  const totalCancelled = fridayData.reduce((sum, item) => sum + item.value, 0)

  function toggleTheme() {
    setState((current) => ({
      ...current,
      theme: current.theme === 'dark' ? 'light' : 'dark',
    }))
  }

  function changeWeek(offsetDays) {
    setState((current) => {
      const currentStart = new Date(`${current.currentWeekStart}T00:00:00`)
      const nextWeekKey = toDateKey(addDays(currentStart, offsetDays))
      return {
        ...current,
        currentWeekStart: nextWeekKey,
        weeks: {
          ...current.weeks,
          [nextWeekKey]: current.weeks[nextWeekKey] ?? makeEmptyWeek(),
        },
      }
    })
  }

  function addEntry(kind, label) {
    setState((current) => {
      const week = current.weeks[current.currentWeekStart] ?? makeEmptyWeek()
      const calledAt = new Date()
      const cancelAt = addDays(calledAt, 20)
      const newEntry = {
        id: crypto.randomUUID(),
        kind,
        label,
        calledAt: calledAt.toISOString(),
        cancelAt: cancelAt.toISOString(),
      }

      return {
        ...current,
        weeks: {
          ...current.weeks,
          [current.currentWeekStart]: {
            ...week,
            entries: [newEntry, ...week.entries],
          },
        },
      }
    })
  }

  function removeEntry(id) {
    setState((current) => {
      const week = current.weeks[current.currentWeekStart] ?? makeEmptyWeek()

      return {
        ...current,
        weeks: {
          ...current.weeks,
          [current.currentWeekStart]: {
            ...week,
            entries: week.entries.filter((item) => item.id !== id),
          },
        },
      }
    })
  }

  function clearAll() {
    setState((current) => ({
      ...current,
      weeks: {
        ...current.weeks,
        [current.currentWeekStart]: makeEmptyWeek(),
      },
    }))
  }

  function updateSelected(kind, value) {
    setState((current) => {
      const week = current.weeks[current.currentWeekStart] ?? makeEmptyWeek()
      return {
        ...current,
        weeks: {
          ...current.weeks,
          [current.currentWeekStart]: {
            ...week,
            [kind === 'thursday' ? 'thursdaySelected' : 'fridaySelected']: value,
          },
        },
      }
    })
  }

  const weekRangeLabel = getWeekRangeLabel(state.currentWeekStart)

  const calledLogs = currentWeek.entries.filter((item) => item.kind === 'thursday')
  const cancelledLogs = currentWeek.entries.filter((item) => item.kind === 'friday')

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

  return (
    <main className="app-shell">
      <header className="top-nav">
        <h1 className="brand">RX Tracker</h1>
        <nav>
          {['Dashboard', 'Statistics'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`nav-btn ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'Dashboard' ? '◻' : '◯'}
            </button>
          ))}
        </nav>
        <div className="right-actions">
          <button
            type="button"
            className="icon-btn"
            title="Sync to cloud"
            onClick={saveToCloud}
          >
            ☁
          </button>
          <a
            className="icon-link"
            href="https://github.com/kashkigan/rts-tracker"
            target="_blank"
            rel="noreferrer"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.72-4.04-1.41-4.04-1.41a3.18 3.18 0 0 0-1.34-1.76c-1.09-.74.08-.73.08-.73a2.53 2.53 0 0 1 1.85 1.24 2.58 2.58 0 0 0 3.52 1 2.58 2.58 0 0 1 .77-1.62c-2.66-.3-5.46-1.33-5.46-5.92A4.63 4.63 0 0 1 5.64 8.9a4.3 4.3 0 0 1 .12-3.18s1-.33 3.3 1.24a11.4 11.4 0 0 1 6 0c2.27-1.57 3.3-1.24 3.3-1.24a4.3 4.3 0 0 1 .12 3.18 4.63 4.63 0 0 1 1.23 3.2c0 4.6-2.8 5.61-5.47 5.9a2.9 2.9 0 0 1 .82 2.24v3.32c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"
              />
            </svg>
          </a>
          <a
            className="icon-link"
            href="https://www.linkedin.com/in/kiranpal-gandhi"
            target="_blank"
            rel="noreferrer"
            title="LinkedIn"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A1.96 1.96 0 1 0 5.3 6.9 1.96 1.96 0 0 0 5.25 3ZM20.44 13.15c0-3.44-1.84-5.04-4.3-5.04a3.8 3.8 0 0 0-3.42 1.88V8.5H9.34V20h3.38v-6.05c0-1.59.3-3.13 2.27-3.13 1.95 0 1.98 1.82 1.98 3.23V20h3.38v-6.85Z"
              />
            </svg>
          </a>
          <button type="button" className="icon-btn" onClick={toggleTheme} title="Theme">
            {state.theme === 'dark' ? '◐' : '◑'}
          </button>
        </div>
      </header>
      <div className="week-header">
        <button type="button" className="icon-btn" onClick={() => changeWeek(-7)} title="Previous week">
          ←
        </button>
        <h2>{weekRangeLabel}</h2>
        <button type="button" className="icon-btn" onClick={() => changeWeek(7)} title="Next week">
          →
        </button>
      </div>
      <div className="cloud-row">{cloudMessage}</div>

      {activeTab === 'Dashboard' && (
        <section className="dashboard-grid">
          <div className="panel">
            <h3>Calls</h3>
            <p>{totalCalls}</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={thursdayData} dataKey="value" nameKey="name" outerRadius={76}>
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
                value={currentWeek.thursdaySelected}
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
                onClick={() => addEntry('thursday', currentWeek.thursdaySelected)}
              >
                +
              </button>
            </div>
          </div>
          <div className="panel">
            <h3>Cancelled</h3>
            <p>{totalCancelled}</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={fridayData} dataKey="value" nameKey="name" outerRadius={76}>
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
                value={currentWeek.fridaySelected}
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
                onClick={() => addEntry('friday', currentWeek.fridaySelected)}
              >
                +
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'Statistics' && (
        <section className="panel">
          <div className="stats-row">
            <div>
              <h3>Week Stats</h3>
              <p>Called: {totalCalls}</p>
              <p>Cancelled: {totalCancelled}</p>
              <p>Total logs: {currentWeek.entries.length}</p>
            </div>
            <button type="button" className="danger-btn" onClick={clearAll}>
              Reset Week
            </button>
          </div>
          <div className="log-sections">
            <div>
              <h4>Call Logs</h4>
              <ul className="history-list">
                {calledLogs.length === 0 && <li>No logs.</li>}
                {calledLogs.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.label}</span>
                    <button type="button" className="ghost-btn" onClick={() => removeEntry(entry.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Cancel Logs</h4>
              <ul className="history-list">
                {cancelledLogs.length === 0 && <li>No logs.</li>}
                {cancelledLogs.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.label}</span>
                    <button type="button" className="ghost-btn" onClick={() => removeEntry(entry.id)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
      <footer className="app-footer">
        <p>Made by Kiranpal Gandhi 2026</p>
      </footer>
    </main>
  )
}

export default App
