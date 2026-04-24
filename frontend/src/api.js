const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function getPullQueue() {
  const response = await fetch(`${API_BASE_URL}/prescriptions/pull-queue`);
  if (!response.ok) {
    throw new Error("Could not load pull queue");
  }
  return response.json();
}

export async function getWeeklyReport() {
  const response = await fetch(`${API_BASE_URL}/reports/weekly`);
  if (!response.ok) {
    throw new Error("Could not load weekly report");
  }
  return response.json();
}

export async function createPrescription(payload) {
  const response = await fetch(`${API_BASE_URL}/prescriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Could not create prescription");
  }
  return response.json();
}
