import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  getAdminBookings,
  updateAdminBookingStatus,
  getAdminMasters,
} from "../api/admin.js";

const STATUS_LABELS = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждена",
  CANCELLED: "Отменена",
  COMPLETED: "Завершена",
};

const STATUS_COLORS = {
  PENDING: "#e8a800",
  CONFIRMED: "#1a8c3a",
  CANCELLED: "#b0b0b0",
  COMPLETED: "#3366cc",
};

const VALID_ACTIONS = {
  PENDING: [
    { label: "Подтвердить", status: "CONFIRMED", color: "#1a8c3a" },
    { label: "Отменить", status: "CANCELLED", color: "#c44" },
  ],
  CONFIRMED: [
    { label: "Завершить", status: "COMPLETED", color: "#3366cc" },
    { label: "Отменить", status: "CANCELLED", color: "#c44" },
  ],
};

const SALON_TIMEZONE = "Europe/Ulyanovsk";

function formatDate(iso, timeZone = undefined) {
  if (!iso) return "—";
  const opts = { day: "numeric", month: "short", year: "numeric" };
  if (timeZone) opts.timeZone = timeZone;
  return new Date(iso).toLocaleDateString("ru-RU", opts);
}

function formatTime(iso, timeZone = undefined) {
  if (!iso) return "—";
  const opts = { hour: "2-digit", minute: "2-digit" };
  if (timeZone) opts.timeZone = timeZone;
  return new Date(iso).toLocaleTimeString("ru-RU", opts);
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clientDisplay(client) {
  if (!client) return "—";
  const parts = [];
  if (client.name && client.name !== "unknown") parts.push(client.name);
  if (client.telegramId) parts.push(`TG:${client.telegramId}`);
  else if (client.email) parts.push(client.email);
  return parts.join(" · ") || "—";
}

export function AdminBookingsPage({ adminUser, onLogout }) {
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterMaster, setFilterMaster] = useState("");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterDateFrom) params.dateFrom = filterDateFrom;
      if (filterDateTo) params.dateTo = filterDateTo;
      if (filterMaster) params.masterId = filterMaster;
      const data = await getAdminBookings(params);
      setBookings(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить записи");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDateFrom, filterDateTo, filterMaster]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    getAdminMasters().then(setMasters);
  }, []);

  const handleStatusChange = async (bookingId, newStatus) => {
    setActionLoading(bookingId);
    try {
      await updateAdminBookingStatus(bookingId, newStatus);
      await loadBookings();
    } catch (e) {
      alert(e.message || "Ошибка");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    adminLogout();
    onLogout();
    navigate("/admin/login", { replace: true });
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterMaster("");
  };

  const hasFilters = filterStatus || filterDateFrom || filterDateTo || filterMaster;

  return (
    <div style={s.wrapper}>
      <div style={s.container}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Записи</h1>
            <nav style={s.nav}>
              <button style={{ ...s.navBtn, ...s.navBtnActive }}>Записи</button>
              <button onClick={() => navigate("/admin/catalog")} style={s.navBtn}>Каталог</button>
              <button onClick={() => navigate("/admin/masters")} style={s.navBtn}>Мастера</button>
            </nav>
          </div>
          <div style={s.headerRight}>
            <span style={s.email}>{adminUser?.email}</span>
            <button onClick={handleLogout} style={s.logoutBtn}>Выйти</button>
          </div>
        </header>

        {/* Filters */}
        <div style={s.filters}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Статус</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={s.filterSelect}
            >
              <option value="">Все</option>
              <option value="PENDING">Ожидает</option>
              <option value="CONFIRMED">Подтверждена</option>
              <option value="CANCELLED">Отменена</option>
              <option value="COMPLETED">Завершена</option>
            </select>
          </div>

          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Дата от</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              style={s.filterInput}
            />
          </div>

          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Дата до</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              style={s.filterInput}
            />
          </div>

          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Мастер</label>
            <select
              value={filterMaster}
              onChange={(e) => setFilterMaster(e.target.value)}
              style={s.filterSelect}
            >
              <option value="">Все мастера</option>
              {masters.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} style={s.clearBtn}>Сбросить</button>
          )}
        </div>

        {/* Content */}
        <section style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#c44" }}>{error}</p>
          ) : bookings.length === 0 ? (
            <p style={s.msg}>
              {hasFilters ? "По выбранным фильтрам записей не найдено." : "Записей пока нет."}
            </p>
          ) : (
            <>
              <div style={s.count}>
                Найдено записей: {bookings.length}
              </div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Клиент</th>
                      <th style={s.th}>Услуга</th>
                      <th style={s.th}>Мастер</th>
                      <th style={s.th}>Дата</th>
                      <th style={s.th}>Время</th>
                      <th style={s.th}>Статус</th>
                      <th style={s.th}>Создана</th>
                      <th style={s.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => {
                      const actions = VALID_ACTIONS[b.status] || [];
                      const isActing = actionLoading === b.id;
                      return (
                        <tr key={b.id} style={s.tr}>
                          <td style={s.td}>{clientDisplay(b.client)}</td>
                          <td style={s.td}>
                            {b.service ? (
                              <>
                                {b.service.name}
                                <span style={s.sub}>
                                  {b.service.durationMin} мин · {b.service.price} ₽
                                </span>
                              </>
                            ) : "—"}
                          </td>
                          <td style={s.td}>{b.master?.name || "—"}</td>
                          <td style={s.td}>{formatDate(b.scheduledAt, SALON_TIMEZONE)}</td>
                          <td style={s.td}>{formatTime(b.scheduledAt, SALON_TIMEZONE)}</td>
                          <td style={s.td}>
                            <span
                              style={{
                                ...s.badge,
                                background: STATUS_COLORS[b.status] || "#888",
                              }}
                            >
                              {STATUS_LABELS[b.status] || b.status}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={s.subText}>{formatDateTime(b.createdAt)}</span>
                          </td>
                          <td style={s.td}>
                            <div style={s.actions}>
                              {actions.map((a) => (
                                <button
                                  key={a.status}
                                  disabled={isActing}
                                  onClick={() => handleStatusChange(b.id, a.status)}
                                  style={{ ...s.actionBtn, background: a.color }}
                                >
                                  {isActing ? "…" : a.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const s = {
  wrapper: { minHeight: "100vh", background: "#f5f5f5" },
  container: { maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "20px",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "20px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700, color: "#1a1a1a" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  nav: { display: "flex", gap: "4px" },
  navBtn: {
    padding: "6px 14px", border: "1px solid #ddd", borderRadius: "6px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#555",
  },
  navBtnActive: {
    background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a",
  },
  email: { fontSize: "14px", color: "#666" },
  logoutBtn: {
    padding: "8px 16px", border: "1px solid #ddd", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#333",
  },
  filters: {
    display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end",
    marginBottom: "20px", padding: "16px", background: "#fff",
    borderRadius: "10px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "12px", fontWeight: 600, color: "#666" },
  filterSelect: {
    padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px",
    fontSize: "14px", minWidth: "140px", background: "#fff",
  },
  filterInput: {
    padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px",
    fontSize: "14px",
  },
  clearBtn: {
    padding: "8px 14px", border: "none", borderRadius: "6px",
    background: "#eee", fontSize: "13px", cursor: "pointer", color: "#555",
    alignSelf: "flex-end",
  },
  content: {
    background: "#fff", borderRadius: "12px", padding: "24px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  msg: { color: "#888", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  count: { fontSize: "13px", color: "#999", marginBottom: "12px" },
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%", borderCollapse: "collapse", fontSize: "14px",
  },
  th: {
    textAlign: "left", padding: "10px 12px", borderBottom: "2px solid #eee",
    fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase",
    letterSpacing: "0.5px", whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f0f0f0" },
  td: { padding: "10px 12px", verticalAlign: "top" },
  sub: { display: "block", fontSize: "12px", color: "#999", marginTop: "2px" },
  subText: { fontSize: "12px", color: "#999" },
  badge: {
    display: "inline-block", padding: "3px 10px", borderRadius: "12px",
    fontSize: "12px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap",
  },
  actions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  actionBtn: {
    padding: "5px 12px", border: "none", borderRadius: "6px",
    fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
