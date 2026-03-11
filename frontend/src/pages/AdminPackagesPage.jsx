import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogout, getAdminPackages, updateAdminPackage } from "../api/admin.js";

const CATEGORY_LABELS = {
  LASER: "Лазер",
  WAX: "Воск",
  ELECTRO: "Электро",
  MASSAGE: "Массаж",
};

const CATEGORY_FILTER_OPTIONS = [
  { value: "", label: "Все" },
  { value: "LASER", label: "Лазер" },
  { value: "WAX", label: "Воск" },
  { value: "ELECTRO", label: "Электро" },
  { value: "MASSAGE", label: "Массаж" },
];

const GENDER_LABELS = {
  FEMALE: "Жен",
  MALE: "Муж",
  UNISEX: "Унисекс",
  NONE: "Без пола",
};

const GENDER_FILTER_OPTIONS = [
  { value: "", label: "Все" },
  { value: "FEMALE", label: "Жен" },
  { value: "MALE", label: "Муж" },
  { value: "UNISEX", label: "Унисекс" },
  { value: "NONE", label: "Без пола" },
];

function genderDisplay(gender) {
  if (gender == null) return GENDER_LABELS.NONE;
  return GENDER_LABELS[gender] ?? gender;
}

export function AdminPackagesPage({ adminUser, onLogout }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterShowOnWebsite, setFilterShowOnWebsite] = useState("");
  const [filterShowInBot, setFilterShowInBot] = useState("");
  const [filterIsVisible, setFilterIsVisible] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminPackages(filterGender ? { gender: filterGender } : {});
      setItems(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить комплексы");
    } finally {
      setLoading(false);
    }
  }, [filterGender]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({
      name: item.name ?? "",
      isVisible: item.isVisible ?? true,
      showOnWebsite: item.showOnWebsite ?? true,
      showInBot: item.showInBot ?? false,
      sortOrder: item.sortOrder != null ? String(item.sortOrder) : "0",
    });
    setSaveError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setSaveError("");
  };

  const handleDraftChange = (field, value) => {
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const nameVal = (editDraft.name ?? "").trim();
    if (!nameVal) {
      setSaveError("Укажите название");
      return;
    }
    const sortVal = Number(editDraft.sortOrder);
    if (isNaN(sortVal) || sortVal < 0) {
      setSaveError("Порядок сортировки не меньше 0");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await updateAdminPackage(editingId, {
        name: nameVal,
        isVisible: editDraft.isVisible,
        showOnWebsite: editDraft.showOnWebsite,
        showInBot: editDraft.showInBot,
        sortOrder: sortVal,
      });
      setEditingId(null);
      setEditDraft({});
      await loadItems();
    } catch (e) {
      setSaveError(e.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterCategory && item.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(item.name ?? "").toLowerCase().includes(q)) return false;
    }
    if (filterShowOnWebsite === "shown" && !item.showOnWebsite) return false;
    if (filterShowOnWebsite === "hidden" && item.showOnWebsite) return false;
    if (filterShowInBot === "enabled" && !item.showInBot) return false;
    if (filterShowInBot === "hidden" && item.showInBot) return false;
    if (filterIsVisible === "active" && !item.isVisible) return false;
    if (filterIsVisible === "inactive" && item.isVisible) return false;
    return true;
  });

  const handleLogout = () => {
    adminLogout();
    onLogout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-layout" style={s.wrapper}>
      <div className="admin-container" style={s.container}>
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Комплексы</h1>
            <nav className="admin-nav">
              <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
              <button type="button" onClick={() => navigate("/admin/catalog")} className="admin-nav-btn">Каталог</button>
              <button type="button" onClick={() => navigate("/admin/services")} className="admin-nav-btn">Услуги</button>
              <button type="button" className="admin-nav-btn active">Комплексы</button>
              <button type="button" onClick={() => navigate("/admin/zones")} className="admin-nav-btn">Зоны</button>
              <button type="button" onClick={() => navigate("/admin/masters")} className="admin-nav-btn">Мастера</button>
            </nav>
          </div>
          <div style={s.headerRight}>
            <span style={s.email}>{adminUser?.email}</span>
            <button type="button" onClick={handleLogout} className="admin-logout-btn" style={s.logoutBtn}>Выйти</button>
          </div>
        </header>

        <div className="admin-filters-card" style={s.toolbar}>
          <div style={s.toolbarFilters}>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Тип процедуры</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={s.filterSelect}
              >
                {CATEGORY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Пол</label>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                style={s.filterSelect}
              >
                {GENDER_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Поиск по названию</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Название…"
                style={s.searchInput}
              />
            </div>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>На сайте</label>
              <select
                value={filterShowOnWebsite}
                onChange={(e) => setFilterShowOnWebsite(e.target.value)}
                style={s.filterSelect}
              >
                <option value="">Все</option>
                <option value="shown">Показаны</option>
                <option value="hidden">Скрыты</option>
              </select>
            </div>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>В боте</label>
              <select
                value={filterShowInBot}
                onChange={(e) => setFilterShowInBot(e.target.value)}
                style={s.filterSelect}
              >
                <option value="">Все</option>
                <option value="enabled">Включены</option>
                <option value="hidden">Скрыты</option>
              </select>
            </div>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Активность</label>
              <select
                value={filterIsVisible}
                onChange={(e) => setFilterIsVisible(e.target.value)}
                style={s.filterSelect}
              >
                <option value="">Все</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </select>
            </div>
          </div>
          <button onClick={loadItems} style={s.refreshBtn} disabled={loading}>
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#b91c1c" }}>{error}</p>
          ) : filteredItems.length === 0 ? (
            <p style={s.msg}>
              {filterGender || filterCategory || searchQuery
                ? "Нет комплексов по выбранному фильтру."
                : "Нет комплексов (нормализованных)."}
            </p>
          ) : (
            <>
              <div style={s.count}>Комплексов: {filteredItems.length}{filteredItems.length !== items.length ? ` из ${items.length}` : ""}</div>
              <div className="admin-table-wrap" style={s.tableWrap}>
                <table className="admin-table" style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Название</th>
                      <th style={s.th}>Категория</th>
                      <th style={s.th}>Пол</th>
                      <th style={s.th}>Цена</th>
                      <th style={s.th}>Длительность</th>
                      <th style={s.th}>Локация</th>
                      <th style={s.th}>На сайте</th>
                      <th style={s.th}>В боте</th>
                      <th style={s.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const isEditing = editingId === item.id;
                      if (isEditing) {
                        return (
                          <tr key={item.id} style={s.trEditing}>
                            <td style={s.td}>
                              <input
                                style={s.editInput}
                                value={editDraft.name}
                                onChange={(e) => handleDraftChange("name", e.target.value)}
                                placeholder="Название"
                              />
                            </td>
                            <td style={s.td}>
                              <span style={s.badge}>
                                {CATEGORY_LABELS[item.category] ?? item.category ?? "—"}
                              </span>
                            </td>
                            <td style={s.td}>{genderDisplay(item.gender)}</td>
                            <td style={s.td}>
                              <span style={s.readonlyValue}>{item.price != null ? `${item.price} ₽` : "—"}</span>
                              <span style={s.readonlyHint}>авто</span>
                            </td>
                            <td style={s.td}>
                              <span style={s.readonlyValue}>{item.durationMin != null ? `${item.durationMin} мин` : "—"}</span>
                              <span style={s.readonlyHint}>авто</span>
                            </td>
                            <td style={s.td}>{item.location?.name ?? "—"}</td>
                            <td style={s.td}>
                              <input type="checkbox" style={s.checkboxInput}
                                checked={editDraft.showOnWebsite ?? false}
                                onChange={(e) => handleDraftChange("showOnWebsite", e.target.checked)} />
                            </td>
                            <td style={s.td}>
                              <input type="checkbox" style={s.checkboxInput}
                                checked={editDraft.showInBot ?? false}
                                onChange={(e) => handleDraftChange("showInBot", e.target.checked)} />
                            </td>
                            <td style={s.td}>
                              <label style={s.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  checked={editDraft.isVisible}
                                  onChange={(e) => handleDraftChange("isVisible", e.target.checked)}
                                  style={s.checkboxInput}
                                />
                                Видно
                              </label>
                              <input
                                style={{ ...s.editInputNarrow, marginTop: 4 }}
                                type="number"
                                min="0"
                                placeholder="Порядок"
                                value={editDraft.sortOrder}
                                onChange={(e) => handleDraftChange("sortOrder", e.target.value)}
                              />
                              <div style={s.actions}>
                                <button type="button" onClick={handleSave} disabled={saving} style={{ ...s.actionBtn, background: "#1a8c3a" }}>
                                  {saving ? "…" : "Сохранить"}
                                </button>
                                <button type="button" onClick={cancelEdit} disabled={saving} style={{ ...s.actionBtn, background: "#888" }}>
                                  Отмена
                                </button>
                              </div>
                              {saveError && <div style={s.saveError}>{saveError}</div>}
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={item.id} style={s.tr}>
                          <td style={s.td}>{item.name}</td>
                          <td style={s.td}>
                            <span style={s.badge}>
                              {CATEGORY_LABELS[item.category] ?? item.category ?? "—"}
                            </span>
                          </td>
                          <td style={s.td}>{genderDisplay(item.gender)}</td>
                          <td style={s.td}>{item.price != null ? `${item.price} ₽` : "—"}</td>
                          <td style={s.td}>{item.durationMin != null ? `${item.durationMin} мин` : "—"}</td>
                          <td style={s.td}>{item.location?.name ?? "—"}</td>
                          <td style={s.td}>{item.showOnWebsite ? "✅" : "—"}</td>
                          <td style={s.td}>{item.showInBot ? "✅" : "—"}</td>
                          <td style={s.td}>
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              disabled={editingId != null}
                              style={{ ...s.actionBtn, background: "#3366cc" }}
                            >
                              Редактировать
                            </button>
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
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  toolbarFilters: { display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "12px", fontWeight: 600, color: "#6b7280" },
  filterSelect: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", minWidth: "140px", background: "#fff",
  },
  searchInput: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", minWidth: "180px", background: "#fff", boxSizing: "border-box",
  },
  refreshBtn: {
    padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
  },
  content: { padding: "24px", marginBottom: "24px" },
  msg: { color: "#6b7280", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  count: { fontSize: "13px", color: "#6b7280", marginBottom: "12px" },
  tableWrap: { overflowX: "auto", width: "100%" },
  table: { tableLayout: "auto", width: "100%" },
  th: { padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#374151" },
  tr: { borderBottom: "1px solid #e5e7eb" },
  td: { padding: "12px 14px", verticalAlign: "top" },
  badge: {
    display: "inline-block", padding: "4px 8px", borderRadius: "8px",
    fontSize: "11px", fontWeight: 600, color: "#374151", background: "#e5e7eb", whiteSpace: "nowrap",
  },
  subText: { fontSize: "12px", color: "#6b7280" },
  trEditing: { borderBottom: "1px solid #e5e7eb", background: "#f8fafc" },
  editInput: {
    padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: "6px",
    fontSize: "13px", width: "100%", maxWidth: "200px", boxSizing: "border-box",
  },
  editInputNarrow: {
    padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: "6px",
    fontSize: "13px", width: "72px", boxSizing: "border-box",
  },
  checkboxLabel: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" },
  checkboxInput: { width: "16px", height: "16px", cursor: "pointer", margin: 0 },
  actions: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" },
  actionBtn: {
    padding: "6px 12px", border: "none", borderRadius: "6px",
    fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer",
  },
  saveError: { fontSize: "11px", color: "#b91c1c", marginTop: "4px" },
  readonlyValue: { fontSize: "13px", color: "#374151" },
  readonlyHint: { display: "block", fontSize: "10px", color: "#9ca3af", marginTop: "2px" },
};
