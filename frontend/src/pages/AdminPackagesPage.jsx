import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  getAdminPackages,
  updateAdminPackage,
  createAdminPackage,
  getAdminServices,
  getAdminLocations,
} from "../api/admin.js";

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

const GENDER_CREATE_OPTIONS = [
  { value: "FEMALE", label: "Жен" },
  { value: "MALE", label: "Муж" },
  { value: "UNISEX", label: "Унисекс" },
];

const CATEGORY_CREATE_OPTIONS = [
  { value: "LASER", label: "Лазер" },
  { value: "WAX", label: "Воск" },
  { value: "ELECTRO", label: "Электро (недоступно)", disabled: true },
  { value: "MASSAGE", label: "Массаж" },
];

const ELECTRO_PACKAGE_NOTE = "Для электроэпиляции комплексы не используются. Используйте пакеты времени или абонементы.";

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
  const [togglingId, setTogglingId] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [locations, setLocations] = useState([]);
  const [builderServices, setBuilderServices] = useState([]);
  const [createDraft, setCreateDraft] = useState({
    category: "WAX",
    gender: "FEMALE",
    locationId: "",
    selectedServiceIds: [],
    name: "",
    isVisible: true,
    showOnWebsite: true,
    showInBot: false,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const openCreateForm = useCallback(async () => {
    setCreateError("");
    try {
      const locs = await getAdminLocations();
      setLocations(locs);
      setCreateDraft((prev) => ({
        ...prev,
        locationId: locs.length > 0 ? locs[0].id : "",
        selectedServiceIds: [],
        name: "",
      }));
      setShowCreate(true);
      setBuilderServices([]);
    } catch (e) {
      setCreateError(e.message || "Не удалось загрузить данные");
    }
  }, []);

  const loadBuilderServices = useCallback(async () => {
    if (!createDraft.category || !createDraft.gender || !createDraft.locationId) {
      setBuilderServices([]);
      return;
    }
    try {
      const svc = await getAdminServices({
        category: createDraft.category,
        gender: createDraft.gender,
        locationId: createDraft.locationId,
        serviceKind: "BUSINESS",
        bookableOnly: true,
      });
      setBuilderServices(svc);
    } catch {
      setBuilderServices([]);
    }
  }, [createDraft.category, createDraft.gender, createDraft.locationId]);

  useEffect(() => {
    if (showCreate) loadBuilderServices();
  }, [showCreate, loadBuilderServices]);

  const toggleServiceSelection = (serviceId) => {
    setCreateDraft((prev) => {
      const ids = prev.selectedServiceIds.includes(serviceId)
        ? prev.selectedServiceIds.filter((id) => id !== serviceId)
        : [...prev.selectedServiceIds, serviceId];
      const selected = builderServices.filter((s) => ids.includes(s.id));
      const compositionLabel = selected.map((s) => s.name).join(" + ");
      return {
        ...prev,
        selectedServiceIds: ids,
        name: compositionLabel || prev.name,
      };
    });
  };

  const handleCreate = async () => {
    const nameVal = (createDraft.name ?? "").trim();
    if (!nameVal) { setCreateError("Укажите название"); return; }
    if (!createDraft.selectedServiceIds.length) { setCreateError("Выберите хотя бы одну услугу"); return; }
    if (!createDraft.locationId) { setCreateError("Выберите локацию"); return; }

    setCreating(true);
    setCreateError("");
    try {
      await createAdminPackage({
        name: nameVal,
        category: createDraft.category,
        gender: createDraft.gender,
        locationId: createDraft.locationId,
        serviceIds: createDraft.selectedServiceIds,
        isVisible: createDraft.isVisible,
        showOnWebsite: createDraft.showOnWebsite,
        showInBot: createDraft.showInBot,
      });
      setShowCreate(false);
      setCreateDraft({
        category: "WAX",
        gender: "FEMALE",
        locationId: "",
        selectedServiceIds: [],
        name: "",
        isVisible: true,
        showOnWebsite: true,
        showInBot: false,
      });
      await loadItems();
    } catch (e) {
      setCreateError(e.message || "Не удалось создать комплекс");
    } finally {
      setCreating(false);
    }
  };

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

  const handleToggle = async (item, field) => {
    const next = !item[field];
    setTogglingId(item.id);
    try {
      await updateAdminPackage(item.id, { [field]: next });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, [field]: next } : i))
      );
    } catch (e) {
      setError(e.message || "Не удалось изменить");
    } finally {
      setTogglingId(null);
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
              <label style={s.filterLabel}>Активна в системе</label>
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
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={loadItems} style={s.refreshBtn} disabled={loading}>
              {loading ? "…" : "Обновить"}
            </button>
            <button
              onClick={openCreateForm}
              disabled={showCreate}
              style={{ ...s.refreshBtn, background: "#1a8c3a", color: "#fff", border: "none", fontWeight: 600 }}
            >
              Создать комплекс
            </button>
          </div>
        </div>

        {showCreate && (
          <section className="admin-card" style={{ ...s.content, marginBottom: 16, border: "2px solid #1a8c3a" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Новый комплекс</h3>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>1. Параметры</div>
              <div style={s.createFieldRow}>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Тип процедуры</label>
                  <select
                    style={s.filterSelect}
                    value={createDraft.category}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, category: e.target.value, selectedServiceIds: [] }))}
                  >
                    {CATEGORY_CREATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Пол</label>
                  <select
                    style={s.filterSelect}
                    value={createDraft.gender}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, gender: e.target.value, selectedServiceIds: [] }))}
                  >
                    {GENDER_CREATE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Локация</label>
                  <select
                    style={s.filterSelect}
                    value={createDraft.locationId}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, locationId: e.target.value, selectedServiceIds: [] }))}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p style={{ ...s.subText, marginTop: 8, width: "100%" }}>{ELECTRO_PACKAGE_NOTE}</p>
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>2. Выбор услуг</div>
              {builderServices.length === 0 ? (
                <p style={s.subText}>Выберите тип процедуры, пол и локацию</p>
              ) : (
                <div style={s.serviceList}>
                  {builderServices.map((svc) => (
                    <label key={svc.id} style={s.serviceCheckItem}>
                      <input
                        type="checkbox"
                        checked={createDraft.selectedServiceIds.includes(svc.id)}
                        onChange={() => toggleServiceSelection(svc.id)}
                        style={s.checkboxInput}
                      />
                      <span>{svc.name}</span>
                      <span style={s.serviceMeta}>{svc.durationMin} мин · {svc.price} ₽</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>3. Предпросмотр</div>
              {createDraft.selectedServiceIds.length > 0 ? (
                <>
                  <p style={s.subText}>
                    Состав: {builderServices.filter((s) => createDraft.selectedServiceIds.includes(s.id)).map((s) => s.name).join(" + ")}
                  </p>
                  <p style={s.subText}>
                    Цена: {builderServices.filter((s) => createDraft.selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.price || 0), 0)} ₽
                  </p>
                  <p style={s.subText}>
                    Длительность: {builderServices.filter((s) => createDraft.selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + (s.durationMin || 0), 0)} мин
                  </p>
                </>
              ) : (
                <p style={s.subText}>Выберите услуги</p>
              )}
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>4. Название</div>
              <input
                style={s.searchInput}
                value={createDraft.name}
                onChange={(e) => setCreateDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="Бикини + Голени"
              />
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>5. Видимость</div>
              <div style={s.createFieldRow}>
                <label style={s.toggleLabel}>
                  <input type="checkbox" style={s.checkboxInput}
                    checked={createDraft.isVisible}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, isVisible: e.target.checked }))} />
                  Активен
                </label>
                <label style={s.toggleLabel}>
                  <input type="checkbox" style={s.checkboxInput}
                    checked={createDraft.showOnWebsite}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, showOnWebsite: e.target.checked }))} />
                  На сайте
                </label>
                <label style={s.toggleLabel}>
                  <input type="checkbox" style={s.checkboxInput}
                    checked={createDraft.showInBot}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, showInBot: e.target.checked }))} />
                  В боте
                </label>
              </div>
            </div>

            {createError && <div style={s.saveError}>{createError}</div>}

            <div style={{ display: "flex", gap: "8px", marginTop: 16 }}>
              <button
                onClick={handleCreate}
                disabled={creating || !createDraft.selectedServiceIds.length}
                style={{ ...s.actionBtn, background: "#1a8c3a", padding: "8px 20px", fontSize: "13px" }}
              >
                {creating ? "Создание…" : "Создать"}
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(""); }}
                disabled={creating}
                style={{ ...s.actionBtn, background: "#888", padding: "8px 20px", fontSize: "13px" }}
              >
                Отмена
              </button>
            </div>
          </section>
        )}

        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#b91c1c" }}>{error}</p>
          ) : filteredItems.length === 0 ? (
            <p style={s.msg}>
              {filterGender || filterCategory || searchQuery
                ? "Нет комплексов по выбранному фильтру."
                : "Нет комплексов."}
            </p>
          ) : (
            <>
              <div style={s.count}>Комплексов: {filteredItems.length}{filteredItems.length !== items.length ? ` из ${items.length}` : ""}</div>
              <div className="admin-table-wrap" style={s.tableWrap}>
                <table className="admin-table" style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Название</th>
                      <th style={s.th}>Состав</th>
                      <th style={s.th}>Тип процедуры</th>
                      <th style={s.th}>Пол</th>
                      <th style={s.th}>Цена</th>
                      <th style={s.th}>Длительность</th>
                      <th style={s.th}>Локация</th>
                      <th style={s.th}>На сайте</th>
                      <th style={s.th}>В боте</th>
                      <th style={s.th}>Активна в системе</th>
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
                              <span style={s.compositionText}>
                                {(item.services ?? []).map((svc) => svc.name).join(" + ") || "—"}
                              </span>
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
                                Активен
                              </label>
                            </td>
                            <td style={s.td}>
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
                            <span style={s.compositionText}>
                              {(item.services ?? []).map((svc) => svc.name).join(" + ") || "—"}
                            </span>
                          </td>
                          <td style={s.td}>
                            <span style={s.badge}>
                              {CATEGORY_LABELS[item.category] ?? item.category ?? "—"}
                            </span>
                          </td>
                          <td style={s.td}>{genderDisplay(item.gender)}</td>
                          <td style={s.td}>{item.price != null ? `${item.price} ₽` : "—"}</td>
                          <td style={s.td}>{item.durationMin != null ? `${item.durationMin} мин` : "—"}</td>
                          <td style={s.td}>{item.location?.name ?? "—"}</td>
                          <td style={s.td}>
                            <label style={s.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={!!item.showOnWebsite}
                                onChange={() => handleToggle(item, "showOnWebsite")}
                                disabled={togglingId === item.id}
                                style={s.checkboxInput}
                              />
                            </label>
                          </td>
                          <td style={s.td}>
                            <label style={s.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={!!item.showInBot}
                                onChange={() => handleToggle(item, "showInBot")}
                                disabled={togglingId === item.id}
                                style={s.checkboxInput}
                              />
                            </label>
                          </td>
                          <td style={s.td}>
                            <label style={s.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={!!item.isVisible}
                                onChange={() => handleToggle(item, "isVisible")}
                                disabled={togglingId === item.id}
                                style={s.checkboxInput}
                              />
                            </label>
                          </td>
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
  compositionText: { fontSize: "12px", color: "#374151", maxWidth: "200px" },
  createSection: {
    marginBottom: "24px",
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
  },
  createSectionTitle: { fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "12px" },
  createFieldRow: { display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end", marginBottom: "12px" },
  createField: { display: "flex", flexDirection: "column", gap: "4px" },
  serviceList: { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" },
  serviceCheckItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    background: "#fff",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    cursor: "pointer",
  },
  serviceMeta: { fontSize: "12px", color: "#6b7280" },
  toggleLabel: { display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer", marginRight: "16px" },
};
