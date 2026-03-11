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

const STATUS_CLASSES = {
  PENDING: "admin-status-pending",
  CONFIRMED: "admin-status-confirmed",
  CANCELLED: "admin-status-cancelled",
  COMPLETED: "admin-status-completed",
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
    <div className="admin-layout" style={s.wrapper}>
      <div className="admin-container" style={s.container}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Записи</h1>
            <nav className="admin-nav">
              <button type="button" className="admin-nav-btn active">Записи</button>
              <button type="button" onClick={() => navigate("/admin/catalog")} className="admin-nav-btn">Каталог</button>
              <button type="button" onClick={() => navigate("/admin/services")} className="admin-nav-btn">Услуги</button>
              <button type="button" onClick={() => navigate("/admin/packages")} className="admin-nav-btn">Комплексы</button>
              <button type="button" onClick={() => navigate("/admin/zones")} className="admin-nav-btn">Зоны</button>
              <button type="button" onClick={() => navigate("/admin/masters")} className="admin-nav-btn">Мастера</button>
            </nav>
          </div>
          <div style={s.headerRight}>
            <span style={s.email}>{adminUser?.email}</span>
            <button type="button" onClick={handleLogout} className="admin-logout-btn" style={s.logoutBtn}>Выйти</button>
          </div>
        </header>

        {/* Filters */}
        <div className="admin-filters-card" style={s.filters}>
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
            <button type="button" onClick={clearFilters} className="admin-clear-btn" style={s.clearBtn}>Сбросить</button>
          )}
        </div>

        {/* Content */}
        <section className="admin-card" style={s.content}>
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
              <div className="admin-table-wrap">
                <table className="admin-table">
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
                            <span className={`admin-status-badge ${STATUS_CLASSES[b.status] || ""}`}>
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
  wrapper: { minHeight: "100vh" },
  container: {},
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "24px",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "20px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700, color: "#111827" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  email: { fontSize: "14px", color: "#6b7280" },
  logoutBtn: {
    padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
  },
  filters: {
    display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "12px", fontWeight: 600, color: "#6b7280" },
  filterSelect: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", minWidth: "140px", background: "#fff",
  },
  filterInput: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px",
  },
  clearBtn: {
    padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#6b7280",
    alignSelf: "flex-end",
  },
  content: { padding: "24px", marginBottom: "24px" },
  msg: { color: "#6b7280", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  count: { fontSize: "13px", color: "#6b7280", marginBottom: "12px" },
  th: {},
  tr: {},
  td: {},
  sub: { display: "block", fontSize: "12px", color: "#6b7280", marginTop: "2px" },
  subText: { fontSize: "12px", color: "#6b7280" },
  actions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  actionBtn: {
    padding: "6px 12px", border: "none", borderRadius: "6px",
    fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
