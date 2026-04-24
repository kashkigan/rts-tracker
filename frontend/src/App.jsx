import { useEffect, useState } from "react";
import { createPrescription, getPullQueue, getWeeklyReport } from "./api";

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
};

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [queue, setQueue] = useState([]);
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("");

  async function loadDashboard() {
    const [queueRes, reportRes] = await Promise.all([getPullQueue(), getWeeklyReport()]);
    setQueue(queueRes.items || []);
    setReport(reportRes.summary || null);
  }

  useEffect(() => {
    loadDashboard().catch(() => setStatus("Could not load dashboard"));
  }, []);

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
      setStatus("Cancellation recorded");
      setForm(initialForm);
      await loadDashboard();
    } catch {
      setStatus("Failed to save cancellation");
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 960, margin: "2rem auto" }}>
      <h1>Prescription RTS Tracker</h1>
      <p>Thursday cancel + Friday pull/call workflow.</p>

      <section>
        <h2>Record canceled prescription</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8 }}>
          <input placeholder="Patient ID" value={form.patient_external_id} onChange={(e) => updateField("patient_external_id", e.target.value)} required />
          <input placeholder="Patient name" value={form.patient_name} onChange={(e) => updateField("patient_name", e.target.value)} required />
          <input placeholder="Rx #" value={form.rx_number} onChange={(e) => updateField("rx_number", e.target.value)} required />
          <input placeholder="Medication" value={form.medication_name} onChange={(e) => updateField("medication_name", e.target.value)} required />
          <input type="datetime-local" value={form.canceled_at} onChange={(e) => updateField("canceled_at", e.target.value)} required />
          <input placeholder="Cancel note" value={form.cancel_note} onChange={(e) => updateField("cancel_note", e.target.value)} />

          <label><input type="checkbox" checked={form.is_antibiotic} onChange={(e) => updateField("is_antibiotic", e.target.checked)} /> Antibiotic</label>
          <label><input type="checkbox" checked={form.is_waiter} onChange={(e) => updateField("is_waiter", e.target.checked)} /> Waiter</label>
          <label><input type="checkbox" checked={form.is_fridge_item} onChange={(e) => updateField("is_fridge_item", e.target.checked)} /> Fridge item</label>
          <label><input type="checkbox" checked={form.is_narcotic} onChange={(e) => updateField("is_narcotic", e.target.checked)} /> Narcotic</label>
          <label><input type="checkbox" checked={form.is_central_fill} onChange={(e) => updateField("is_central_fill", e.target.checked)} /> Central fill</label>

          <button type="submit">Save cancellation</button>
        </form>
        {status && <p>{status}</p>}
      </section>

      <section>
        <h2>Friday pull queue</h2>
        <ul>
          {queue.map((item) => (
            <li key={item.prescription_id}>
              {item.pull_due_date} · {item.patient_name} · Rx {item.rx_number} · {item.medication_name}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Weekly summary</h2>
        {report ? (
          <ul>
            <li>Total canceled: {report.total_canceled}</li>
            <li>Antibiotics: {report.antibiotics}</li>
            <li>Waiters: {report.waiters}</li>
            <li>Fridge: {report.fridge_items}</li>
            <li>Narcotics: {report.narcotics}</li>
            <li>Central fill: {report.central_fill}</li>
          </ul>
        ) : (
          <p>No report yet</p>
        )}
      </section>
    </main>
  );
}
