const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function handle(response, message) {
  if (!response.ok) {
    throw new Error(message);
  }
  return response.json();
}

export async function getPullQueue() {
  return handle(await fetch(`${API_BASE_URL}/prescriptions/pull-queue`), "Could not load pull queue");
}

export async function getDashboard(period) {
  return handle(await fetch(`${API_BASE_URL}/reports/dashboard?period=${period}`), "Could not load dashboard report");
}

export async function getPrescriptions(period) {
  return handle(await fetch(`${API_BASE_URL}/prescriptions?period=${period}`), "Could not load prescriptions");
}

export async function createPrescription(payload) {
  return handle(
    await fetch(`${API_BASE_URL}/prescriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
    "Could not create prescription"
  );
}

export async function deletePrescription(id) {
  return handle(
    await fetch(`${API_BASE_URL}/prescriptions/${id}`, {
      method: "DELETE",
    }),
    "Could not delete prescription"
  );
}
