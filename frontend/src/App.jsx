import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { createPrescription, deletePrescription, getDashboard, getPrescriptions, getPullQueue } from "./api";

const initialForm = {
  patient_external_id: "",
  patient_name: "",
  rx_number: "",
  medication_name: "",
  canceled_at: new Date().toISOString().slice(0, 16),
  cancel_note: "",
  is_antibiotic: false,
  is_waiter: false,
  is_fridge_item: false,
  is_narcotic: false,
  is_central_fill: false,
  is_regular_med: false,
};

const periodOptions = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "3m", label: "Past 3 months" },
  { value: "6m", label: "Past 6 months" },
];

const chartColors = ["#0077b6", "#ffb703", "#2a9d8f"];

const themes = {
  light: {
    page: "#f8fafc",
    card: "#ffffff",
    text: "#0f172a",
    border: "#dbe3ec",
    muted: "#475569",
    button: "#e2e8f0",
  },
  dark: {
    page: "#0b1220",
    card: "#111a2d",
    text: "#e2e8f0",
    border: "#2b3852",
    muted: "#94a3b8",
    button: "#1e293b",
  },
};

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [period, setPeriod] = useState("week");
  const [theme, setTheme] = useState("light");
  const [queue, setQueue] = useState([]);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");

  const colors = themes[theme];

  async function loadDashboard(selectedPeriod = period) {
    const [queueRes, dashboardRes, entriesRes] = await Promise.all([
      getPullQueue(),
      getDashboard(selectedPeriod),
      getPrescriptions(selectedPeriod),
    ]);
    setQueue(queueRes.items || []);
    setSummary(dashboardRes.summary || null);
    setEntries(entriesRes.entries || []);
  }

  useEffect(() => {
    loadDashboard(period).catch(() => setStatus("Could not load dashboard"));
  }, [period]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await createPrescription({
        ...form,
        canceled_at: new Date(form.canceled_at).toISOString(),
      });
      setStatus("Cancellation saved");
      setForm(initialForm);
      await loadDashboard();
    } catch {
      setStatus("Failed to save cancellation");
    }
  }

  async function handleDelete(id) {
    try {
      await deletePrescription(id);
      setStatus("Log deleted");
      await loadDashboard();
    } catch {
      setStatus("Failed to delete log");
    }
  }

  const pieData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.status_counts)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [summary]);

  function cardStyle() {
    return { border: `1px solid ${colors.border}`, padding: 12, borderRadius: 8, background: colors.card };
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 1100, margin: "0 auto", minHeight: "100vh", background: colors.page, color: colors.text, padding: "2rem 1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Prescription RTS Tracker</h1>
          <p style={{ margin: 0, color: colors.muted }}>Track Thursday cancellations and Friday calls/pulls for each week you work.</p>
        </div>
        <button
          onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          style={{ border: `1px solid ${colors.border}`, background: colors.button, color: colors.text, borderRadius: 8, padding: "0.5rem 0.75rem" }}
        >
          {theme === "light" ? "🌙 Dark mode" : "☀️ Light mode"}
        </button>
      </header>

      <section style={{ marginBottom: 16 }}>
        <label>
          Dashboard period:{" "}
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periodOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </section>

      {summary && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 24 }}>
          <Stat title="Total canceled" value={summary.total_cancelled} colors={colors} />
          <Stat title="Total scripts called" value={summary.total_scripts_called} colors={colors} />
          <Stat title="Narcotics" value={summary.narcotics} colors={colors} />
          <Stat title="Antibiotics" value={summary.antibiotics} colors={colors} />
          <Stat title="Waiters" value={summary.waiters} colors={colors} />
          <Stat title="Fridge" value={summary.fridge_items} colors={colors} />
          <Stat title="Central fill" value={summary.central_fill} colors={colors} />
          <Stat title="Regular meds" value={summary.regular_meds} colors={colors} />
        </section>
      )}

      <section style={{ ...cardStyle(), marginBottom: 24 }}>
        <h2>Status pie chart</h2>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90}>
                {pieData.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ ...cardStyle(), marginBottom: 24 }}>
        <h2>Add canceled prescription</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
          <input placeholder="Patient ID" value={form.patient_external_id} onChange={(e) => updateField("patient_external_id", e.target.value)} required />
          <input placeholder="Patient name" value={form.patient_name} onChange={(e) => updateField("patient_name", e.target.value)} required />
          <input placeholder="Rx #" value={form.rx_number} onChange={(e) => updateField("rx_number", e.target.value)} required />
          <input placeholder="Medication" value={form.medication_name} onChange={(e) => updateField("medication_name", e.target.value)} required />
          <input type="datetime-local" value={form.canceled_at} onChange={(e) => updateField("canceled_at", e.target.value)} required />
          <input placeholder="Cancel note" value={form.cancel_note} onChange={(e) => updateField("cancel_note", e.target.value)} />

          <label><input type="checkbox" checked={form.is_regular_med} onChange={(e) => updateField("is_regular_med", e.target.checked)} /> Regular medication</label>
          <label><input type="checkbox" checked={form.is_antibiotic} onChange={(e) => updateField("is_antibiotic", e.target.checked)} /> Antibiotic</label>
          <label><input type="checkbox" checked={form.is_waiter} onChange={(e) => updateField("is_waiter", e.target.checked)} /> Waiter</label>
          <label><input type="checkbox" checked={form.is_fridge_item} onChange={(e) => updateField("is_fridge_item", e.target.checked)} /> Fridge item</label>
          <label><input type="checkbox" checked={form.is_narcotic} onChange={(e) => updateField("is_narcotic", e.target.checked)} /> Narcotic</label>
          <label><input type="checkbox" checked={form.is_central_fill} onChange={(e) => updateField("is_central_fill", e.target.checked)} /> Central fill</label>

          <button type="submit">Add log</button>
        </form>
      </section>

      <section style={{ ...cardStyle(), marginBottom: 24 }}>
        <h2>Logs ({periodOptions.find((x) => x.value === period)?.label})</h2>
        <ul style={{ padding: 0, listStyle: "none" }}>
          {entries.map((entry) => (
            <li key={entry.prescription_id} style={{ border: `1px solid ${colors.border}`, marginBottom: 6, padding: 8, borderRadius: 8 }}>
              {entry.canceled_at.slice(0, 10)} · {entry.patient_name} · Rx {entry.rx_number} · {entry.medication_name}
              <button onClick={() => handleDelete(entry.prescription_id)} style={{ marginLeft: 8 }}>Delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section style={cardStyle()}>
        <h2>Friday pull queue</h2>
        <ul>
          {queue.map((item) => (
            <li key={item.prescription_id}>
              {item.pull_due_date} · {item.patient_name} · Rx {item.rx_number} · {item.medication_name}
            </li>
          ))}
        </ul>
      </section>

      {status && <p>{status}</p>}
    </main>
  );
}

function Stat({ title, value, colors }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, padding: 12, borderRadius: 8, background: colors.card }}>
      <strong>{title}</strong>
      <div style={{ fontSize: 24 }}>{value}</div>
    </div>
  );
}
