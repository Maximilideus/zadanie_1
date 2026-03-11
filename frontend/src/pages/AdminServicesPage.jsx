import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  getAdminServices,
  updateAdminService,
  getAdminZones,
  getAdminLocations,
  createAdminService,
} from "../api/admin.js";

const CATEGORY_LABELS = {
  LASER: "Лазер",
  WAX: "Воск",
  ELECTRO: "Электро",
  MASSAGE: "Массаж",
};

const CATEGORY_OPTIONS = [
  { value: "", label: "—" },
  { value: "LASER", label: "Лазер" },
  { value: "WAX", label: "Воск" },
  { value: "ELECTRO", label: "Электро" },
  { value: "MASSAGE", label: "Массаж" },
];

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

const GENDER_EDIT_OPTIONS = [
  { value: "", label: "Без пола" },
  { value: "FEMALE", label: "Жен" },
  { value: "MALE", label: "Муж" },
  { value: "UNISEX", label: "Унисекс" },
];

const GROUPKEY_OPTIONS = [
  { value: "face", label: "Лицо" },
  { value: "body", label: "Тело" },
  { value: "intimate", label: "Интимная зона" },
  { value: "other", label: "Другое" },
];

const GROUPKEY_EDIT_OPTIONS = [
  { value: "", label: "—" },
  ...GROUPKEY_OPTIONS,
];

const GROUPKEY_CONFIRM_MSG = "Вы изменяете раздел отображения услуги на сайте.\nЭто может повлиять на структуру прайса.";

const GROUPKEY_LABELS = { face: "Лицо", body: "Тело", intimate: "Интимная зона", other: "Другое" };

function groupKeyDisplay(gk) {
  if (gk == null || gk === "") return "—";
  return GROUPKEY_LABELS[gk] ?? gk;
}

function genderDisplay(gender) {
  if (gender == null) return GENDER_LABELS.NONE;
  return GENDER_LABELS[gender] ?? gender;
}

export function AdminServicesPage({ adminUser, onLogout }) {
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
  const [showLegacy, setShowLegacy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showGroupKeyConfirm, setShowGroupKeyConfirm] = useState(false);

  // ── Create form state ──────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [zones, setZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [createDraft, setCreateDraft] = useState({
    name: "",
    category: "LASER",
    gender: "FEMALE",
    zoneKey: "",
    groupKey: "other",
    price: "",
    durationMin: "",
    locationId: "",
    isVisible: true,
    showOnWebsite: true,
    showInBot: true,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const openCreateForm = useCallback(async () => {
    setCreateError("");
    try {
      const [z, l] = await Promise.all([getAdminZones(), getAdminLocations()]);
      setZones(z);
      setLocations(l);
      const activeZones = z.filter((zone) => zone.isActive);
      setCreateDraft((prev) => ({
        ...prev,
        locationId: l.length > 0 ? l[0].id : "",
        zoneKey: activeZones.length > 0 ? activeZones[0].zoneKey : "",
        groupKey: "other",
      }));
      setShowCreate(true);
    } catch (e) {
      setCreateError(e.message || "Не удалось загрузить данные для формы");
    }
  }, []);

  const handleCreateDraftChange = (field, value) => {
    setCreateDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    const nameVal = (createDraft.name ?? "").trim();
    if (!nameVal) { setCreateError("Укажите название"); return; }
    if (!createDraft.zoneKey) { setCreateError("Выберите зону"); return; }
    if (!createDraft.locationId) { setCreateError("Выберите локацию"); return; }
    if (!createDraft.groupKey) { setCreateError("Выберите раздел на сайте"); return; }
    const priceVal = Number(createDraft.price);
    if (isNaN(priceVal) || priceVal < 0) { setCreateError("Цена >= 0"); return; }
    const durVal = Number(createDraft.durationMin);
    if (isNaN(durVal) || durVal < 1) { setCreateError("Длительность >= 1 мин"); return; }

    setCreating(true);
    setCreateError("");
    try {
      await createAdminService({
        name: nameVal,
        category: createDraft.category,
        gender: createDraft.gender || null,
        zoneKey: createDraft.zoneKey,
        groupKey: createDraft.groupKey,
        price: priceVal,
        durationMin: durVal,
        locationId: createDraft.locationId,
        isVisible: createDraft.isVisible,
        showOnWebsite: createDraft.showOnWebsite,
        showInBot: createDraft.showInBot,
      });
      setShowCreate(false);
      setCreateDraft({
        name: "", category: "LASER", gender: "FEMALE", zoneKey: "",
        groupKey: "other", price: "", durationMin: "", locationId: "",
        isVisible: true, showOnWebsite: true, showInBot: true,
      });
      await loadItems();
    } catch (e) {
      setCreateError(e.message || "Не удалось создать услугу");
    } finally {
      setCreating(false);
    }
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filterGender) params.gender = filterGender;
      params.serviceKind = showLegacy ? "LEGACY_TEMPLATE" : "BUSINESS";
      const data = await getAdminServices(params);
      setItems(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить услуги");
    } finally {
      setLoading(false);
    }
  }, [filterGender, showLegacy]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({
      name: item.name ?? "",
      category: item.category ?? "",
      gender: item.gender ?? "",
      groupKey: item.groupKey ?? "",
      price: item.price != null ? String(item.price) : "",
      durationMin: item.durationMin != null ? String(item.durationMin) : "",
      isVisible: item.isVisible ?? true,
      showOnWebsite: item.showOnWebsite ?? true,
      showInBot: item.showInBot ?? true,
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

  const performSave = async () => {
    const nameVal = (editDraft.name ?? "").trim();
    const priceVal = editDraft.price === "" ? undefined : Number(editDraft.price);
    const durVal = editDraft.durationMin === "" ? undefined : Number(editDraft.durationMin);
    const sortVal = Number(editDraft.sortOrder);
    const groupKeyVal = editDraft.groupKey || null;

    setSaving(true);
    setSaveError("");
    try {
      await updateAdminService(editingId, {
        name: nameVal,
        category: editDraft.category || null,
        gender: editDraft.gender || null,
        groupKey: groupKeyVal,
        price: priceVal,
        durationMin: durVal,
        isVisible: editDraft.isVisible,
        showOnWebsite: editDraft.showOnWebsite,
        showInBot: editDraft.showInBot,
        sortOrder: sortVal,
      });
      setEditingId(null);
      setEditDraft({});
      setShowGroupKeyConfirm(false);
      await loadItems();
    } catch (e) {
      setSaveError(e.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const nameVal = (editDraft.name ?? "").trim();
    if (!nameVal) {
      setSaveError("Укажите название");
      return;
    }
    const priceVal = editDraft.price === "" ? undefined : Number(editDraft.price);
    if (priceVal !== undefined && (isNaN(priceVal) || priceVal < 0)) {
      setSaveError("Цена не может быть отрицательной");
      return;
    }
    const durVal = editDraft.durationMin === "" ? undefined : Number(editDraft.durationMin);
    if (durVal !== undefined && (isNaN(durVal) || durVal < 1)) {
      setSaveError("Длительность не меньше 1 минуты");
      return;
    }
    const sortVal = Number(editDraft.sortOrder);
    if (isNaN(sortVal) || sortVal < 0) {
      setSaveError("Порядок сортировки не меньше 0");
      return;
    }

    const originalItem = items.find((i) => i.id === editingId);
    const groupKeyChanged = originalItem && (editDraft.groupKey || null) !== (originalItem.groupKey ?? null);

    if (groupKeyChanged) {
      setShowGroupKeyConfirm(true);
      return;
    }

    await performSave();
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
            <h1 style={s.title}>Услуги</h1>
            <nav className="admin-nav">
              <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
              <button type="button" onClick={() => navigate("/admin/catalog")} className="admin-nav-btn">Каталог</button>
              <button type="button" className="admin-nav-btn active">Услуги</button>
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
              <label style={s.filterLabel}>Поиск услуги</label>
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
            <div style={s.filterGroup}>
              <label style={s.filterLabel}>&nbsp;</label>
              <label style={s.toggleLabel}>
                <input
                  type="checkbox"
                  checked={showLegacy}
                  onChange={(e) => setShowLegacy(e.target.checked)}
                  style={s.checkboxInput}
                />
                Показывать служебные услуги
              </label>
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
              Создать услугу
            </button>
          </div>
        </div>

        {showCreate && (
          <section className="admin-card" style={{ ...s.content, marginBottom: 16, border: "2px solid #1a8c3a" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Новая услуга</h3>

            <div style={s.createFormGrid}>
              <div style={s.createSection}>
                <div style={s.createSectionTitle}>Идентификация</div>
                <div style={s.createFieldRow}>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Категория</label>
                    <select
                      style={s.filterSelect}
                      value={createDraft.category}
                      onChange={(e) => handleCreateDraftChange("category", e.target.value)}
                    >
                      {CATEGORY_FILTER_OPTIONS.filter((o) => o.value).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Пол</label>
                    <select
                      style={s.filterSelect}
                      value={createDraft.gender}
                      onChange={(e) => handleCreateDraftChange("gender", e.target.value)}
                    >
                      {GENDER_EDIT_OPTIONS.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Локация</label>
                    <select
                      style={s.filterSelect}
                      value={createDraft.locationId}
                      onChange={(e) => handleCreateDraftChange("locationId", e.target.value)}
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Зона</label>
                    <select
                      style={s.filterSelect}
                      value={createDraft.zoneKey}
                      onChange={(e) => handleCreateDraftChange("zoneKey", e.target.value)}
                    >
                      {zones.filter((z) => z.isActive).map((z) => (
                        <option key={z.zoneKey} value={z.zoneKey}>{z.labelRu}</option>
                      ))}
                    </select>
                  </div>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Раздел на сайте</label>
                    <select
                      style={s.filterSelect}
                      value={createDraft.groupKey}
                      onChange={(e) => handleCreateDraftChange("groupKey", e.target.value)}
                    >
                      {GROUPKEY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={s.createSection}>
                <div style={s.createSectionTitle}>Параметры услуги</div>
                <div style={s.createFieldRow}>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Название</label>
                    <input
                      style={s.searchInput}
                      value={createDraft.name}
                      onChange={(e) => handleCreateDraftChange("name", e.target.value)}
                      placeholder="Название услуги"
                    />
                  </div>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Цена (₽)</label>
                    <input
                      style={s.editInputNarrow}
                      type="number" min="0"
                      value={createDraft.price}
                      onChange={(e) => handleCreateDraftChange("price", e.target.value)}
                    />
                  </div>
                  <div style={s.createField}>
                    <label style={s.filterLabel}>Длительность (мин)</label>
                    <input
                      style={s.editInputNarrow}
                      type="number" min="1"
                      value={createDraft.durationMin}
                      onChange={(e) => handleCreateDraftChange("durationMin", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={s.createSection}>
                <div style={s.createSectionTitle}>Видимость</div>
                <div style={s.createFieldRow}>
                  <label style={s.toggleLabel}>
                    <input type="checkbox" style={s.checkboxInput}
                      checked={createDraft.isVisible}
                      onChange={(e) => handleCreateDraftChange("isVisible", e.target.checked)} />
                    Видима
                  </label>
                  <label style={s.toggleLabel}>
                    <input type="checkbox" style={s.checkboxInput}
                      checked={createDraft.showOnWebsite}
                      onChange={(e) => handleCreateDraftChange("showOnWebsite", e.target.checked)} />
                    На сайте
                  </label>
                  <label style={s.toggleLabel}>
                    <input type="checkbox" style={s.checkboxInput}
                      checked={createDraft.showInBot}
                      onChange={(e) => handleCreateDraftChange("showInBot", e.target.checked)} />
                    В боте
                  </label>
                </div>
              </div>
            </div>

            {createError && <div style={{ ...s.saveError, marginTop: 8 }}>{createError}</div>}

            <div style={{ display: "flex", gap: "8px", marginTop: 16 }}>
              <button
                onClick={handleCreate}
                disabled={creating}
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

        {showGroupKeyConfirm && (
          <div style={s.modalOverlay} onClick={() => setShowGroupKeyConfirm(false)}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <p style={s.modalText}>{GROUPKEY_CONFIRM_MSG}</p>
              <div style={s.modalActions}>
                <button
                  onClick={() => setShowGroupKeyConfirm(false)}
                  disabled={saving}
                  style={{ ...s.actionBtn, background: "#888" }}
                >
                  Отмена
                </button>
                <button
                  onClick={() => performSave()}
                  disabled={saving}
                  style={{ ...s.actionBtn, background: "#1a8c3a" }}
                >
                  {saving ? "…" : "Изменить"}
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#b91c1c" }}>{error}</p>
          ) : filteredItems.length === 0 ? (
            <p style={s.msg}>
              {filterGender || filterCategory || searchQuery
                ? "Нет услуг по выбранному фильтру."
                : "Нет услуг."}
            </p>
          ) : (
            <>
              <div style={s.count}>Услуг: {filteredItems.length}{filteredItems.length !== items.length ? ` из ${items.length}` : ""}</div>
              <div className="admin-table-wrap" style={s.tableWrap}>
                <table className="admin-table" style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Название</th>
                      <th style={s.th}>Категория</th>
                      <th style={s.th}>Пол</th>
                      <th style={s.th}>Раздел</th>
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
                              <select
                                style={s.filterSelect}
                                value={editDraft.category}
                                onChange={(e) => handleDraftChange("category", e.target.value)}
                              >
                                {CATEGORY_OPTIONS.map((o) => (
                                  <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={s.td}>
                              <select
                                style={s.filterSelect}
                                value={editDraft.gender}
                                onChange={(e) => handleDraftChange("gender", e.target.value)}
                              >
                                {GENDER_EDIT_OPTIONS.map((o) => (
                                  <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={s.td}>
                              <select
                                style={s.filterSelect}
                                value={editDraft.groupKey}
                                onChange={(e) => handleDraftChange("groupKey", e.target.value)}
                              >
                                {GROUPKEY_EDIT_OPTIONS.map((o) => (
                                  <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.editInputNarrow}
                                type="number"
                                min="0"
                                value={editDraft.price}
                                onChange={(e) => handleDraftChange("price", e.target.value)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.editInputNarrow}
                                type="number"
                                min="1"
                                value={editDraft.durationMin}
                                onChange={(e) => handleDraftChange("durationMin", e.target.value)}
                              />
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
                      const isLegacy = item.serviceKind === "LEGACY_TEMPLATE";
                      return (
                        <tr key={item.id} style={isLegacy ? s.trLegacy : s.tr}>
                          <td style={s.td}>
                            {item.name}
                            {isLegacy && <span style={s.legacyBadge}>Шаблон</span>}
                          </td>
                          <td style={s.td}>
                            <span style={s.badge}>
                              {CATEGORY_LABELS[item.category] ?? item.category ?? "—"}
                            </span>
                          </td>
                          <td style={s.td}>{genderDisplay(item.gender)}</td>
                          <td style={s.td}>{groupKeyDisplay(item.groupKey)}</td>
                          <td style={s.td}>{item.price != null ? `${item.price} ₽` : "—"}</td>
                          <td style={s.td}>{item.durationMin != null ? `${item.durationMin} мин` : "—"}</td>
                          <td style={s.td}>{item.location?.name ?? "—"}</td>
                          <td style={s.td}>{item.showOnWebsite ? "✅" : "—"}</td>
                          <td style={s.td}>{item.showInBot ? "✅" : "—"}</td>
                          <td style={s.td}>
                            {isLegacy ? (
                              <span style={s.readonlyLabel}>Только чтение</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                disabled={editingId != null}
                                style={{ ...s.actionBtn, background: "#3366cc" }}
                              >
                                Редактировать
                              </button>
                            )}
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
  fromCatalogBadge: {
    fontSize: "11px", color: "#059669", background: "#d1fae5", padding: "2px 6px", borderRadius: "4px",
  },
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
  toggleLabel: {
    display: "inline-flex", alignItems: "center", gap: "6px",
    fontSize: "13px", cursor: "pointer", paddingTop: "4px",
  },
  trLegacy: { borderBottom: "1px solid #e5e7eb", background: "#f9fafb", opacity: 0.75 },
  legacyBadge: {
    marginLeft: "6px", fontSize: "10px", fontWeight: 600, color: "#92400e",
    background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", verticalAlign: "middle",
  },
  readonlyLabel: {
    fontSize: "11px", fontWeight: 600, color: "#9ca3af",
  },
  createFormGrid: {
    display: "flex", flexDirection: "column", gap: "16px",
  },
  createSection: {},
  createSectionTitle: {
    fontSize: "13px", fontWeight: 700, color: "#374151", marginBottom: "8px",
    borderBottom: "1px solid #e5e7eb", paddingBottom: "4px",
  },
  createFieldRow: {
    display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end",
  },
  createField: {
    display: "flex", flexDirection: "column", gap: "4px",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    padding: "24px",
    borderRadius: "12px",
    maxWidth: 400,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  },
  modalText: {
    whiteSpace: "pre-line",
    margin: "0 0 20px",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#374151",
  },
  modalActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
};
