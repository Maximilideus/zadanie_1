import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { showErrorToast } from "./CustomToast.jsx";

export function AdminPanel({ onBack, session, onSignOut }) {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Фильтры
  const [filterMaster, setFilterMaster] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | active | cancelled
  const [searchEmail, setSearchEmail] = useState("");

  // ─── Загрузка всех записей через RPC ──────────────────────────────────
  useEffect(() => {
    async function loadAllBookings() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_all_bookings");
        if (error) throw error;
        setBookings(data ?? []);
      } catch (e) {
        console.error("Ошибка загрузки админ-данных:", e);
        showErrorToast("Не удалось загрузить записи.");
      } finally {
        setIsLoading(false);
      }
    }
    loadAllBookings();
  }, []);

  // ─── Уникальные мастера для фильтра ──────────────────────────────────
  const masterOptions = useMemo(() => {
    const names = [...new Set(bookings.map((b) => b.master).filter(Boolean))];
    return names.sort();
  }, [bookings]);

  // ─── Фильтрация ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filterMaster && b.master !== filterMaster) return false;
      if (filterDateFrom && b.date < filterDateFrom) return false;
      if (filterDateTo && b.date > filterDateTo) return false;
      if (filterStatus === "active" && b.cancelled) return false;
      if (filterStatus === "cancelled" && !b.cancelled) return false;
      if (searchEmail) {
        const q = searchEmail.toLowerCase();
        const matchEmail = b.client_email?.toLowerCase().includes(q);
        const matchTg = b.telegram_username?.toLowerCase().includes(q);
        const matchName = b.client_name?.toLowerCase().includes(q);
        if (!matchEmail && !matchTg && !matchName) return false;
      }
      return true;
    });
  }, [bookings, filterMaster, filterDateFrom, filterDateTo, filterStatus, searchEmail]);

  // ─── Статистика ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = filtered.filter((b) => !b.cancelled);
    const totalRevenue = active.reduce((sum, b) => sum + (b.price ?? 0), 0);
    const totalBookings = filtered.length;
    const activeBookings = active.length;
    const cancelledBookings = filtered.filter((b) => b.cancelled).length;
    const uniqueClients = new Set(filtered.map((b) => b.client_email)).size;
    return { totalRevenue, totalBookings, activeBookings, cancelledBookings, uniqueClients };
  }, [filtered]);

  const hasFilters = filterMaster || filterDateFrom || filterDateTo || filterStatus !== "all" || searchEmail;

  const clearFilters = () => {
    setFilterMaster("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatus("all");
    setSearchEmail("");
  };

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
  }

  function formatCreatedAt(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="root-bg">
      <main className="page admin-page">
        <section className="card admin-card">

          {/* ─── Шапка ─────────────────────────────────────── */}
          <header className="admin-header">
            <h1 className="admin-title">Админ-панель</h1>
            <div className="user-info">
              <span className="user-email">{session.user.email}</span>
              <div className="mode-switcher">
                <button type="button" className="mode-btn" onClick={onBack}>Сайт</button>
                <button type="button" className="mode-btn mode-btn-active">Админ</button>
              </div>
              <button type="button" className="signout-btn" onClick={onSignOut}>
                Выйти
              </button>
            </div>
          </header>

          {/* ─── Статистика ─────────────────────────────────── */}
          <div className="admin-stats">
            <div className="stat-card stat-revenue">
              <span className="stat-value">{stats.totalRevenue.toLocaleString("ru-RU")} ₽</span>
              <span className="stat-label">Выручка{hasFilters ? " (по фильтру)" : ""}</span>
            </div>
            <div className="stat-card stat-bookings">
              <span className="stat-value">{stats.activeBookings}</span>
              <span className="stat-label">Активных записей</span>
            </div>
            <div className="stat-card stat-cancelled">
              <span className="stat-value">{stats.cancelledBookings}</span>
              <span className="stat-label">Отменённых</span>
            </div>
            <div className="stat-card stat-clients">
              <span className="stat-value">{stats.uniqueClients}</span>
              <span className="stat-label">Клиентов</span>
            </div>
          </div>

          {/* ─── Фильтры ─────────────────────────────────── */}
          <div className="admin-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label className="filter-label">Мастер</label>
                <select
                  className="filter-select"
                  value={filterMaster}
                  onChange={(e) => setFilterMaster(e.target.value)}
                >
                  <option value="">Все мастера</option>
                  {masterOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Статус</label>
                <select
                  className="filter-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">Все</option>
                  <option value="active">Активные</option>
                  <option value="cancelled">Отменённые</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Дата от</label>
                <input
                  type="date"
                  className="filter-input"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">Дата до</label>
                <input
                  type="date"
                  className="filter-input"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>

              <div className="filter-group filter-group-email">
                <label className="filter-label">Клиент</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Email или @username…"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                />
              </div>
            </div>

            {hasFilters && (
              <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                Сбросить фильтры
              </button>
            )}
          </div>

          {/* ─── Таблица записей ─────────────────────────────── */}
          {isLoading ? (
            <p className="admin-loading">Загружаем записи…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-empty">
              {hasFilters ? "Нет записей по выбранным фильтрам." : "Записей пока нет."}
            </p>
          ) : (
            <>
              <div className="admin-table-info">
                Показано {filtered.length} из {bookings.length} записей
              </div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Дата записи</th>
                      <th>Время</th>
                      <th>Услуга</th>
                      <th>Мастер</th>
                      <th>Длит.</th>
                      <th>Цена</th>
                      <th>Клиент</th>
                      <th>Телефон</th>
                      <th>Статус</th>
                      <th>Создана</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr key={b.id} className={b.cancelled ? "row-cancelled" : ""}>
                        <td>{formatDate(b.date)}</td>
                        <td>{b.time ?? "—"}</td>
                        <td>{b.service ?? "—"}</td>
                        <td>{b.master ?? "—"}</td>
                        <td>{b.duration ? `${b.duration} мин` : "—"}</td>
                        <td className="cell-price">
                          {b.price ? `${b.price.toLocaleString("ru-RU")} ₽` : "—"}
                        </td>
                        <td className="cell-email">
                          {b.client_name
                            ? b.client_name
                            : b.client_email
                              ? b.client_email
                              : b.telegram_username
                                ? `@${b.telegram_username}`
                                : b.telegram_id
                                  ? `TG:${b.telegram_id}`
                                  : "—"}
                        </td>
                        <td>{b.client_phone || "—"}</td>
                        <td>
                          <span className={`status-badge ${b.cancelled ? "status-cancelled" : "status-active"}`}>
                            {b.cancelled ? "Отменена" : b.rated ? "Завершена" : "Активна"}
                          </span>
                        </td>
                        <td className="cell-created">{formatCreatedAt(b.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
