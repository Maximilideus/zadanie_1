const API_BASE = import.meta.env.VITE_API_URL ?? "";

const TOKEN_KEY = "admin_token";

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminLogin(email, password) {
  const res = await fetch(`${API_BASE}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Ошибка авторизации");
  }

  const { token } = await res.json();
  setAdminToken(token);
  return token;
}

export async function getAdminMe() {
  const token = getAdminToken();
  if (!token) return null;

  const res = await fetch(`${API_BASE}/admin/auth/me`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    return null;
  }

  return res.json();
}

export function adminLogout() {
  clearAdminToken();
}

export async function getAdminBookings(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.masterId) qs.set("masterId", params.masterId);

  const url = `${API_BASE}/admin/bookings${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить записи");
  }

  const data = await res.json();
  return data.bookings;
}

export async function updateAdminBookingStatus(bookingId, status) {
  const res = await fetch(`${API_BASE}/admin/bookings/${bookingId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось изменить статус");
  }

  return res.json();
}

export async function getAdminMasters() {
  const res = await fetch(`${API_BASE}/admin/masters`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить мастеров");
  }

  const data = await res.json();
  return data.masters ?? [];
}

export async function createAdminMaster(fields) {
  const res = await fetch(`${API_BASE}/admin/masters`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось создать мастера");
  }

  return res.json();
}

export async function updateAdminMaster(id, fields) {
  const res = await fetch(`${API_BASE}/admin/masters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось сохранить изменения");
  }

  return res.json();
}

export async function getAdminZones() {
  const res = await fetch(`${API_BASE}/admin/zones`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить зоны");
  }

  const data = await res.json();
  return data.zones ?? [];
}

export async function createAdminZone(fields) {
  const res = await fetch(`${API_BASE}/admin/zones`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось создать зону");
  }

  return res.json();
}

export async function updateAdminZone(id, fields) {
  const res = await fetch(`${API_BASE}/admin/zones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось сохранить зону");
  }

  return res.json();
}

export async function getAdminServiceZones() {
  const res = await fetch(`${API_BASE}/admin/service-zones`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить зоны услуг");
  }

  const data = await res.json();
  return data.zones ?? [];
}

export async function getAdminLocations() {
  const res = await fetch(`${API_BASE}/admin/locations`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить локации");
  }

  const data = await res.json();
  return data.locations ?? [];
}

export async function createAdminService(fields) {
  const res = await fetch(`${API_BASE}/admin/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось создать услугу");
  }

  return res.json();
}

export async function getAdminServices(params = {}) {
  const qs = new URLSearchParams();
  if (params.gender) qs.set("gender", params.gender);
  if (params.serviceKind) qs.set("serviceKind", params.serviceKind);

  const url = `${API_BASE}/admin/services${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить услуги");
  }

  const data = await res.json();
  return data.services ?? [];
}

export async function updateAdminService(id, fields) {
  const res = await fetch(`${API_BASE}/admin/services/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось сохранить услугу");
  }

  return res.json();
}

export async function getAdminPackages(params = {}) {
  const qs = new URLSearchParams();
  if (params.gender) qs.set("gender", params.gender);

  const url = `${API_BASE}/admin/packages${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить комплексы");
  }

  const data = await res.json();
  return data.packages ?? [];
}

export async function updateAdminPackage(id, fields) {
  const res = await fetch(`${API_BASE}/admin/packages/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось сохранить комплекс");
  }

  return res.json();
}

export async function getAdminCatalog() {
  const res = await fetch(`${API_BASE}/admin/catalog`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearAdminToken();
    throw new Error("Не удалось загрузить каталог");
  }

  const data = await res.json();
  return data.items;
}

export async function updateAdminCatalogItem(id, fields) {
  const res = await fetch(`${API_BASE}/admin/catalog/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(fields),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Не удалось сохранить изменения");
  }

  return res.json();
}
