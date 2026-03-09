import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  getAdminCatalog,
  updateAdminCatalogItem,
} from "../api/admin.js";

const CATEGORY_LABELS = {
  LASER: "Лазер",
  WAX: "Воск",
  ELECTRO: "Электро",
  MASSAGE: "Массаж",
};

const CATEGORY_COLORS = {
  LASER: "#8b5cf6",
  WAX: "#d97706",
  ELECTRO: "#0891b2",
  MASSAGE: "#059669",
};

const TYPE_LABELS = {
  ZONE: "Зона",
  OFFER: "Предложение",
  INFO: "Инфо",
};

const CATEGORIES = ["", "LASER", "WAX", "ELECTRO", "MASSAGE"];

export function AdminCatalogPage({ adminUser, onLogout }) {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminCatalog();
      setItems(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = filterCategory
    ? items.filter((i) => i.category === filterCategory)
    : items;

  const sorted = [...filtered].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.titleRu || "").localeCompare(b.titleRu || "", "ru");
  });

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({
      titleRu: item.titleRu,
      descriptionRu: item.descriptionRu ?? "",
      sessionsNoteRu: item.sessionsNoteRu ?? "",
      price: item.price ?? "",
      durationMin: item.durationMin ?? "",
      isVisible: item.isVisible,
      sortOrder: item.sortOrder,
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
    setSaving(true);
    setSaveError("");

    const fields = {};

    const titleVal = editDraft.titleRu.trim();
    if (!titleVal) {
      setSaveError("Укажите название");
      setSaving(false);
      return;
    }
    fields.titleRu = titleVal;

    fields.descriptionRu = editDraft.descriptionRu.trim() || null;
    fields.sessionsNoteRu = editDraft.sessionsNoteRu.trim() || null;

    const priceVal = editDraft.price === "" ? null : Number(editDraft.price);
    if (priceVal !== null && (isNaN(priceVal) || priceVal < 0)) {
      setSaveError("Цена не может быть отрицательной");
      setSaving(false);
      return;
    }
    fields.price = priceVal;

    const durVal = editDraft.durationMin === "" ? null : Number(editDraft.durationMin);
    if (durVal !== null && (isNaN(durVal) || durVal < 1)) {
      setSaveError("Длительность должна быть не меньше 1 минуты");
      setSaving(false);
      return;
    }
    fields.durationMin = durVal;

    const sortVal = Number(editDraft.sortOrder);
    if (isNaN(sortVal) || sortVal < 0) {
      setSaveError("Порядок сортировки не меньше 0");
      setSaving(false);
      return;
    }
    fields.sortOrder = sortVal;
    fields.isVisible = editDraft.isVisible;

    try {
      await updateAdminCatalogItem(editingId, fields);
      setEditingId(null);
      setEditDraft({});
      await loadItems();
    } catch (e) {
      setSaveError(e.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (item) => {
    try {
      await updateAdminCatalogItem(item.id, { isVisible: !item.isVisible });
      await loadItems();
    } catch (e) {
      alert(e.message || "Ошибка");
    }
  };

  const handleLogout = () => {
    adminLogout();
    onLogout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-layout" style={s.wrapper}>
      <div className="admin-container" style={s.container}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Каталог</h1>
            <nav className="admin-nav">
              <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
              <button type="button" className="admin-nav-btn active">Каталог</button>
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
            <label style={s.filterLabel}>Категория</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={s.filterSelect}
            >
              <option value="">Все категории</option>
              {CATEGORIES.filter(Boolean).map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>

          <button onClick={loadItems} style={s.refreshBtn} disabled={loading}>
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        {/* Content */}
        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#b91c1c" }}>{error}</p>
          ) : sorted.length === 0 ? (
            <p style={s.msg}>
              {filterCategory ? "В этой категории нет позиций." : "В каталоге пока нет позиций."}
            </p>
          ) : (
            <>
              <div style={s.count}>Позиций: {sorted.length}</div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={s.th}>Категория</th>
                      <th style={s.th}>Тип</th>
                      <th style={s.th}>Название</th>
                      <th style={s.th}>Описание</th>
                      <th style={s.th}>Кол-во сеансов / примечание</th>
                      <th style={s.th}>Цена</th>
                      <th style={s.th}>Длительность</th>
                      <th style={s.th}>Порядок</th>
                      <th style={s.th}>На сайте</th>
                      <th style={s.th}>Сервис</th>
                      <th style={s.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((item) => {
                      const isEditing = editingId === item.id;

                      if (isEditing) {
                        return (
                          <tr key={item.id} style={s.trEditing}>
                            <td style={s.td}>
                              <span style={{ ...s.badge, background: CATEGORY_COLORS[item.category] || "#888" }}>
                                {CATEGORY_LABELS[item.category] || item.category}
                              </span>
                            </td>
                            <td style={s.td}>
                              <span style={s.typeLabel}>{TYPE_LABELS[item.type] || item.type}</span>
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.editInput}
                                value={editDraft.titleRu}
                                onChange={(e) => handleDraftChange("titleRu", e.target.value)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.editInput}
                                value={editDraft.descriptionRu}
                                onChange={(e) => handleDraftChange("descriptionRu", e.target.value)}
                                placeholder="—"
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.editInput}
                                value={editDraft.sessionsNoteRu}
                                onChange={(e) => handleDraftChange("sessionsNoteRu", e.target.value)}
                                placeholder="например: 6–8 сеансов"
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={{ ...s.editInput, width: "70px" }}
                                type="number"
                                min="0"
                                value={editDraft.price}
                                onChange={(e) => handleDraftChange("price", e.target.value)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={{ ...s.editInput, width: "60px" }}
                                type="number"
                                min="1"
                                value={editDraft.durationMin}
                                onChange={(e) => handleDraftChange("durationMin", e.target.value)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={{ ...s.editInput, width: "55px" }}
                                type="number"
                                min="0"
                                value={editDraft.sortOrder}
                                onChange={(e) => handleDraftChange("sortOrder", e.target.value)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                type="checkbox"
                                checked={editDraft.isVisible}
                                onChange={(e) => handleDraftChange("isVisible", e.target.checked)}
                                style={s.checkbox}
                              />
                            </td>
                            <td style={s.td}>
                              <span style={s.subText}>{item.serviceId ? "✔" : "—"}</span>
                            </td>
                            <td style={s.td}>
                              <div style={s.actions}>
                                <button
                                  onClick={handleSave}
                                  disabled={saving}
                                  style={{ ...s.actionBtn, background: "#1a8c3a" }}
                                >
                                  {saving ? "…" : "Сохранить"}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  style={{ ...s.actionBtn, background: "#888" }}
                                >
                                  Отмена
                                </button>
                              </div>
                              {saveError && <div style={s.saveError}>{saveError}</div>}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} style={{ ...s.tr, opacity: item.isVisible ? 1 : 0.5 }}>
                          <td style={s.td}>
                            <span style={{ ...s.badge, background: CATEGORY_COLORS[item.category] || "#888" }}>
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={s.typeLabel}>{TYPE_LABELS[item.type] || item.type}</span>
                          </td>
                          <td style={s.td}>
                            {item.titleRu}
                            {item.subtitleRu && (
                              <span style={s.sub}>{item.subtitleRu}</span>
                            )}
                          </td>
                          <td style={s.td}>
                            <span style={s.subText}>{item.descriptionRu || "—"}</span>
                          </td>
                          <td style={s.td}>
                            <span style={s.subText}>{item.sessionsNoteRu || "—"}</span>
                          </td>
                          <td style={s.td}>{item.price != null ? `${item.price} ₽` : "—"}</td>
                          <td style={s.td}>{item.durationMin != null ? `${item.durationMin} мин` : "—"}</td>
                          <td style={s.td}>{item.sortOrder}</td>
                          <td style={s.td}>
                            <button
                              onClick={() => handleToggleVisibility(item)}
                              style={s.visToggle}
                              title={item.isVisible ? "Скрыть с сайта" : "Показать на сайте"}
                            >
                              {item.isVisible ? "👁" : "🚫"}
                            </button>
                          </td>
                          <td style={s.td}>
                            <span style={s.subText}>{item.serviceId ? "✔" : "—"}</span>
                          </td>
                          <td style={s.td}>
                            <button
                              onClick={() => startEdit(item)}
                              disabled={editingId !== null}
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
  filters: {
    display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end",
  },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "12px", fontWeight: 600, color: "#6b7280" },
  filterSelect: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", minWidth: "160px", background: "#fff",
  },
  refreshBtn: {
    padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
    marginLeft: "auto",
  },
  content: { padding: "24px", marginBottom: "24px" },
  msg: { color: "#6b7280", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  count: { fontSize: "13px", color: "#6b7280", marginBottom: "12px" },
  th: {},
  tr: { borderBottom: "1px solid #f3f4f6" },
  trEditing: { background: "#f9fafb" },
  td: {},
  sub: { display: "block", fontSize: "12px", color: "#6b7280", marginTop: "2px" },
  subText: { fontSize: "13px", color: "#6b7280" },
  badge: {
    display: "inline-block", padding: "4px 10px", borderRadius: "12px",
    fontSize: "11px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap",
  },
  typeLabel: { fontSize: "12px", color: "#6b7280" },
  editInput: {
    padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: "6px",
    fontSize: "13px", width: "100%", boxSizing: "border-box",
  },
  checkbox: { width: "18px", height: "18px", cursor: "pointer" },
  visToggle: {
    background: "none", border: "none", fontSize: "18px", cursor: "pointer",
    padding: "2px 6px",
  },
  actions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  actionBtn: {
    padding: "6px 12px", border: "none", borderRadius: "6px",
    fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer",
    whiteSpace: "nowrap",
  },
  saveError: { fontSize: "11px", color: "#b91c1c", marginTop: "4px" },
};
