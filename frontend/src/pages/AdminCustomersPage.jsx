import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogout, getAdminCustomers, createAdminCustomer } from "../api/admin.js";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminCustomersPage({ adminUser, onLogout }) {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminCustomers({ page, limit, q: searchQ || undefined });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e.message || "Не удалось загрузить клиентов");
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQ]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQ(searchInput.trim());
    setPage(1);
  };

  const handleLogout = () => {
    adminLogout();
    onLogout();
    navigate("/admin/login", { replace: true });
  };

  const totalPages = Math.ceil(total / limit) || 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const showNoResultsCreate = searchQ && items.length === 0 && !loading && !error;
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const name = createName.trim();
    const phone = createPhone.trim();
    if (!name || !phone) {
      setCreateError("Укажите имя и телефон.");
      return;
    }
    setCreateError("");
    setCreating(true);
    try {
      const customer = await createAdminCustomer({ name, phone, notes: createNotes.trim() || undefined });
      navigate(`/admin/customers/${customer.id}`);
    } catch (err) {
      setCreateError(err.message || "Не удалось создать клиента.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-layout" style={s.wrapper}>
      <div className="admin-container" style={s.container}>
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Клиенты</h1>
            <nav className="admin-nav">
              <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
              <button type="button" onClick={() => navigate("/admin/customers")} className="admin-nav-btn active">Клиенты</button>
              <button type="button" onClick={() => navigate("/admin/catalog")} className="admin-nav-btn">Каталог</button>
              <button type="button" onClick={() => navigate("/admin/services")} className="admin-nav-btn">Услуги</button>
              <button type="button" onClick={() => navigate("/admin/packages")} className="admin-nav-btn">Комплексы</button>
              <button type="button" onClick={() => navigate("/admin/subscriptions")} className="admin-nav-btn">Абонементы</button>
              <button type="button" onClick={() => navigate("/admin/zones")} className="admin-nav-btn">Зоны</button>
              <button type="button" onClick={() => navigate("/admin/masters")} className="admin-nav-btn">Мастера</button>
            </nav>
          </div>
          <div style={s.headerRight}>
            <span style={s.email}>{adminUser?.email}</span>
            <button type="button" onClick={handleLogout} className="admin-logout-btn" style={s.logoutBtn}>Выйти</button>
          </div>
        </header>

        <div className="admin-filters-card" style={s.filters}>
          <form onSubmit={handleSearchSubmit} style={s.searchForm}>
            <input
              type="text"
              placeholder="Поиск по имени или телефону"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={s.searchInput}
            />
            <button type="submit" style={s.searchBtn}>Найти</button>
          </form>
        </div>

        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#c44" }}>{error}</p>
          ) : items.length === 0 ? (
            <div style={s.noResults}>
              <p style={s.msg}>
                {searchQ ? "По запросу клиентов не найдено." : "Клиентов пока нет."}
              </p>
              {showNoResultsCreate && (
                <div style={s.createBlock}>
                  <p style={s.createTitle}>Создать клиента</p>
                  <form onSubmit={handleCreateSubmit} style={s.createForm}>
                    <div style={s.createRow}>
                      <label style={s.createLabel}>Имя *</label>
                      <input
                        type="text"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        placeholder="Имя"
                        style={s.createInput}
                        disabled={creating}
                      />
                    </div>
                    <div style={s.createRow}>
                      <label style={s.createLabel}>Телефон *</label>
                      <input
                        type="text"
                        value={createPhone}
                        onChange={(e) => setCreatePhone(e.target.value)}
                        placeholder="Телефон"
                        style={s.createInput}
                        disabled={creating}
                      />
                    </div>
                    <div style={s.createRow}>
                      <label style={s.createLabel}>Заметки</label>
                      <input
                        type="text"
                        value={createNotes}
                        onChange={(e) => setCreateNotes(e.target.value)}
                        placeholder="Заметки (необязательно)"
                        style={s.createInput}
                        disabled={creating}
                      />
                    </div>
                    {createError && (
                      <p style={s.createError}>{createError}</p>
                    )}
                    <button
                        type="submit"
                        disabled={creating || !createName.trim() || !createPhone.trim()}
                        style={s.createBtn}
                      >
                        {creating ? "Создание…" : "Создать"}
                      </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={s.count}>
                Найдено: {total}
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={s.th}>Имя</th>
                      <th style={s.th}>Телефон</th>
                      <th style={s.th}>Telegram</th>
                      <th style={s.th}>Создан</th>
                      <th style={s.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr key={c.id} style={s.tr}>
                        <td style={s.td}>{c.name || "—"}</td>
                        <td style={s.td}>{c.phone || "—"}</td>
                        <td style={s.td}>
                          {c.telegramUsername ? `@${c.telegramUsername}` : "—"}
                        </td>
                        <td style={s.td}>
                          <span style={s.subText}>{formatDateTime(c.createdAt)}</span>
                        </td>
                        <td style={s.td}>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/customers/${c.id}`)}
                            style={s.openBtn}
                          >
                            Открыть
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={s.pagination}>
                  <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={() => setPage((p) => p - 1)}
                    style={s.pageBtn}
                  >
                    Назад
                  </button>
                  <span style={s.pageInfo}>
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => setPage((p) => p + 1)}
                    style={s.pageBtn}
                  >
                    Вперёд
                  </button>
                </div>
              )}
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
    marginBottom: "24px",
  },
  searchForm: { display: "flex", gap: "8px", alignItems: "center" },
  searchInput: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", minWidth: "220px",
  },
  searchBtn: {
    padding: "8px 16px", border: "none", borderRadius: "8px",
    background: "#1a8c3a", color: "#fff", fontSize: "13px", fontWeight: 600,
    cursor: "pointer",
  },
  content: { padding: "24px", marginBottom: "24px" },
  msg: { color: "#6b7280", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  noResults: { padding: "32px 0" },
  createBlock: {
    maxWidth: "360px", margin: "0 auto", padding: "20px",
    border: "1px solid #e5e7eb", borderRadius: "12px", background: "#fafafa",
  },
  createTitle: { margin: "0 0 16px", fontSize: "16px", fontWeight: 600, color: "#111827" },
  createForm: { display: "flex", flexDirection: "column", gap: "12px" },
  createRow: { display: "flex", flexDirection: "column", gap: "4px" },
  createLabel: { fontSize: "13px", fontWeight: 500, color: "#374151" },
  createInput: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px",
  },
  createError: { margin: 0, fontSize: "13px", color: "#c44" },
  createBtn: {
    padding: "10px 16px", border: "none", borderRadius: "8px",
    background: "#1a8c3a", color: "#fff", fontSize: "14px", fontWeight: 600,
    cursor: "pointer", marginTop: "4px",
  },
  count: { fontSize: "13px", color: "#6b7280", marginBottom: "12px" },
  th: {},
  tr: {},
  td: {},
  subText: { fontSize: "12px", color: "#6b7280" },
  openBtn: {
    padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: "6px",
    background: "#fff", fontSize: "12px", cursor: "pointer", color: "#374151",
  },
  pagination: {
    display: "flex", alignItems: "center", gap: "12px", marginTop: "16px",
  },
  pageBtn: {
    padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: "6px",
    background: "#fff", fontSize: "13px", cursor: "pointer",
  },
  pageInfo: { fontSize: "13px", color: "#6b7280" },
};
