import React, { useEffect, useState, useCallback } from "react";
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
  PACKAGE: "Комплекс",
  SUBSCRIPTION: "Абонемент",
};

const CATEGORIES = ["", "LASER", "WAX", "ELECTRO", "MASSAGE"];

const TYPE_FILTER_OPTIONS = [
  { value: "", label: "Все типы" },
  { value: "SERVICE", label: "Обычная услуга" },
  { value: "PACKAGE", label: "Комплекс" },
  { value: "SUBSCRIPTION", label: "Абонемент" },
];

function matchesTypeFilter(item, filterType) {
  if (!filterType) return true;
  if (filterType === "SERVICE") return ["ZONE", "OFFER", "INFO"].includes(item.type);
  if (filterType === "PACKAGE") return item.type === "PACKAGE";
  if (filterType === "SUBSCRIPTION") return item.type === "SUBSCRIPTION";
  return true;
}

export function AdminCatalogPage({ adminUser, onLogout }) {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filtered = items.filter((i) => {
    if (filterCategory && i.category !== filterCategory) return false;
    if (!matchesTypeFilter(i, filterType)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const title = (i.titleRu || "").toLowerCase();
      const desc = (i.descriptionRu || "").toLowerCase();
      if (!title.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.titleRu || "").localeCompare(b.titleRu || "", "ru");
  });

  const zonesForPackage = (category) =>
    items.filter((i) => i.category === category && i.type === "ZONE");

  const togglePackageZone = (itemId) => {
    const ids = editDraft.packageItemIds ?? [];
    const next = ids.includes(itemId)
      ? ids.filter((id) => id !== itemId)
      : [...ids, itemId];
    setEditDraft((prev) => ({ ...prev, packageItemIds: next }));
  };

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
      type: item.type,
      category: item.category,
      packageItemIds: (item.packageItems ?? []).map((p) => p.itemId),
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

    const isPackage = editDraft.type === "PACKAGE";
    if (!isPackage) {
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
    } else {
      fields.packageItemIds = editDraft.packageItemIds ?? [];
    }

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

        {/* Toolbar: filters + search + actions */}
        <div className="admin-filters-card" style={s.toolbar}>
          <div style={s.toolbarFilters}>
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
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Тип</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={s.filterSelect}
              >
                {TYPE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>Поиск</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Название или описание"
                style={s.searchInput}
              />
            </div>
          </div>
          <div style={s.toolbarActions}>
            <button
              type="button"
              onClick={() => {}}
              style={s.newServiceBtn}
              title="Добавить новую услугу (в разработке)"
            >
              + Новая услуга
            </button>
            <button onClick={loadItems} style={s.refreshBtn} disabled={loading}>
              {loading ? "…" : "Обновить"}
            </button>
          </div>
        </div>

        {/* Content */}
        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#b91c1c" }}>{error}</p>
          ) : sorted.length === 0 ? (
            <p style={s.msg}>
              {filterCategory || filterType || searchQuery.trim()
                ? "Нет позиций по выбранным фильтрам."
                : "В каталоге пока нет позиций."}
            </p>
          ) : (
            <>
              <div style={s.count}>Позиций: {sorted.length}</div>
              <div className="admin-table-wrap admin-catalog-table-wrap" style={s.tableWrap}>
                <table className="admin-table admin-catalog-table" style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.thCat}>Категория</th>
                      <th style={s.thType}>Тип</th>
                      <th style={s.thTitle}>Название</th>
                      <th style={s.thPrice}>Цена</th>
                      <th style={s.thDur}>Длительность</th>
                      <th style={s.thVis}>На сайте</th>
                      <th style={s.thSvc}>Сервис</th>
                      <th style={s.thAct}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((item) => {
                      const isEditing = editingId === item.id;

                      if (isEditing) {
                        return (
                          <React.Fragment key={item.id}>
                            <tr style={s.trEditing}>
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
                                  placeholder="Название"
                                />
                              </td>
                              <td style={s.td}>
                                {editDraft.type === "PACKAGE" ? (
                                  <span style={s.subText}>{item.price != null ? `${item.price} ₽` : "—"}</span>
                                ) : (
                                  <input
                                    style={s.editInputNarrow}
                                    type="number"
                                    min="0"
                                    value={editDraft.price}
                                    onChange={(e) => handleDraftChange("price", e.target.value)}
                                  />
                                )}
                              </td>
                              <td style={s.td}>
                                {editDraft.type === "PACKAGE" ? (
                                  <span style={s.subText}>{item.durationMin != null ? `${item.durationMin} мин` : "—"}</span>
                                ) : (
                                  <input
                                    style={s.editInputNarrow}
                                    type="number"
                                    min="1"
                                    value={editDraft.durationMin}
                                    onChange={(e) => handleDraftChange("durationMin", e.target.value)}
                                  />
                                )}
                              </td>
                              <td style={s.td}>
                                <input
                                  type="checkbox"
                                  checked={editDraft.isVisible}
                                  onChange={(e) => handleDraftChange("isVisible", e.target.checked)}
                                  style={s.checkboxInput}
                                  title={editDraft.isVisible ? "Скрыть с сайта" : "Показать на сайте"}
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
                            <tr style={s.trEditing}>
                              <td colSpan={8} style={s.tdExtra}>
                                <div style={s.extraFields}>
                                  <div style={s.extraRow}>
                                    <label style={s.extraLabel}>Описание</label>
                                    <input
                                      style={s.extraInput}
                                      value={editDraft.descriptionRu}
                                      onChange={(e) => handleDraftChange("descriptionRu", e.target.value)}
                                      placeholder="Описание (необязательно)"
                                    />
                                  </div>
                                  <div style={s.extraRow}>
                                    <label style={s.extraLabel}>Сеансы / примечание</label>
                                    <input
                                      style={s.extraInput}
                                      value={editDraft.sessionsNoteRu}
                                      onChange={(e) => handleDraftChange("sessionsNoteRu", e.target.value)}
                                      placeholder="например: 6–8 сеансов"
                                    />
                                  </div>
                                  <div style={s.extraRow}>
                                    <label style={s.extraLabel}>Порядок сортировки</label>
                                    <input
                                      style={{ ...s.extraInput, width: "80px" }}
                                      type="number"
                                      min="0"
                                      value={editDraft.sortOrder}
                                      onChange={(e) => handleDraftChange("sortOrder", e.target.value)}
                                    />
                                  </div>
                                  {editDraft.type === "PACKAGE" && (
                                    <div style={s.packageZones}>
                                      <span style={s.packageZonesLabel}>Зоны в комплексе:</span>
                                      {zonesForPackage(editDraft.category).map((zone) => (
                                        <label key={zone.id} style={s.checkboxLabel}>
                                          <input
                                            type="checkbox"
                                            checked={(editDraft.packageItemIds ?? []).includes(zone.id)}
                                            onChange={() => togglePackageZone(zone.id)}
                                            style={s.checkboxInput}
                                          />
                                          {zone.titleRu}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      }

                      const secondary = [
                        item.descriptionRu,
                        item.sessionsNoteRu,
                        item.sortOrder != null ? `Порядок: ${item.sortOrder}` : null,
                      ].filter(Boolean).join(" · ");

                      return (
                        <tr key={item.id} style={{ ...s.tr, opacity: item.isVisible ? 1 : 0.6 }}>
                          <td style={s.td}>
                            <span style={{ ...s.badge, background: CATEGORY_COLORS[item.category] || "#888" }}>
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={s.typeLabel}>{TYPE_LABELS[item.type] || item.type}</span>
                          </td>
                          <td style={s.td}>
                            <div style={s.titleBlock}>
                              <span style={s.titleMain}>
                                {item.type === "PACKAGE" && <span style={s.packageTag}>Комплекс: </span>}
                                {item.titleRu}
                              </span>
                              {item.subtitleRu && <span style={s.sub}>{item.subtitleRu}</span>}
                              {secondary && <span style={s.secondary}>{secondary}</span>}
                            </div>
                          </td>
                          <td style={s.td}>{item.price != null ? `${item.price} ₽` : "—"}</td>
                          <td style={s.td}>{item.durationMin != null ? `${item.durationMin} мин` : "—"}</td>
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
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  toolbarFilters: { display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" },
  toolbarActions: { display: "flex", gap: "10px", alignItems: "center", marginLeft: "auto" },
  filterGroup: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "12px", fontWeight: 600, color: "#6b7280" },
  filterSelect: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", minWidth: "140px", background: "#fff",
  },
  searchInput: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", width: "200px", background: "#fff",
  },
  newServiceBtn: {
    padding: "10px 18px", border: "1px solid #2563eb", borderRadius: "8px",
    background: "#2563eb", color: "#fff", fontSize: "14px", fontWeight: 600,
    cursor: "pointer", whiteSpace: "nowrap",
  },
  refreshBtn: {
    padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
  },
  content: { padding: "24px", marginBottom: "24px" },
  msg: { color: "#6b7280", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  count: { fontSize: "13px", color: "#6b7280", marginBottom: "12px" },
  tableWrap: { overflowX: "visible", width: "100%" },
  table: { tableLayout: "fixed", width: "100%" },
  thCat: { width: "10%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  thType: { width: "10%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  thTitle: { width: "28%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  thPrice: { width: "10%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  thDur: { width: "10%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  thVis: { width: "8%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  thSvc: { width: "6%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  thAct: { width: "18%", wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px" },
  tr: { borderBottom: "1px solid #e5e7eb" },
  trEditing: { background: "#f8fafc" },
  td: { wordWrap: "break-word", overflowWrap: "break-word", padding: "12px 14px", verticalAlign: "top" },
  titleBlock: { display: "flex", flexDirection: "column", gap: "2px" },
  titleMain: { fontSize: "14px", fontWeight: 500, color: "#111827" },
  packageTag: { color: "#6b7280", fontWeight: 400 },
  sub: { fontSize: "12px", color: "#6b7280" },
  secondary: { fontSize: "11px", color: "#9ca3af", marginTop: "2px", lineHeight: 1.35 },
  tdExtra: { padding: "12px 14px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" },
  extraFields: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "720px" },
  extraRow: { display: "flex", flexDirection: "column", gap: "4px" },
  extraLabel: { fontSize: "11px", fontWeight: 600, color: "#6b7280" },
  extraInput: {
    padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: "6px",
    fontSize: "13px", maxWidth: "400px", boxSizing: "border-box",
  },
  packageZones: { display: "flex", flexWrap: "wrap", gap: "8px 16px", alignItems: "center", marginTop: "4px" },
  packageZonesLabel: { fontSize: "12px", fontWeight: 600, color: "#6b7280", marginRight: "4px" },
  checkboxInput: { width: "16px", height: "16px", cursor: "pointer", margin: 0 },
  checkboxLabel: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" },
  subText: { fontSize: "13px", color: "#6b7280" },
  badge: {
    display: "inline-block", padding: "4px 8px", borderRadius: "8px",
    fontSize: "11px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap",
  },
  typeLabel: { fontSize: "12px", color: "#6b7280" },
  editInput: {
    padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: "6px",
    fontSize: "13px", width: "100%", boxSizing: "border-box",
  },
  editInputNarrow: {
    padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: "6px",
    fontSize: "13px", width: "72px", boxSizing: "border-box",
  },
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
