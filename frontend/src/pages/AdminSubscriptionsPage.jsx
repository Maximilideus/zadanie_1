import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  getAdminSubscriptions,
  createAdminSubscription,
  updateAdminSubscription,
  getAdminSubscriptionBaseServices,
  getAdminSubscriptionBasePackages,
  getAdminLocations,
} from "../api/admin.js";

const CATEGORY_LABELS = {
  LASER: "Лазер",
  WAX: "Воск",
  ELECTRO: "Электро",
  MASSAGE: "Массаж",
};

const GENDER_LABELS = {
  FEMALE: "Жен",
  MALE: "Муж",
  UNISEX: "Унисекс",
  NONE: "Без пола",
};

const CATEGORY_OPTIONS = [
  { value: "LASER", label: "Лазер" },
  { value: "WAX", label: "Воск" },
  { value: "ELECTRO", label: "Электро" },
  { value: "MASSAGE", label: "Массаж" },
];

const GENDER_OPTIONS = [
  { value: "FEMALE", label: "Жен" },
  { value: "MALE", label: "Муж" },
  { value: "UNISEX", label: "Унисекс" },
  { value: "NONE", label: "Без пола" },
];

function genderDisplay(gender) {
  if (gender == null) return GENDER_LABELS.NONE;
  return GENDER_LABELS[gender] ?? gender;
}

export function AdminSubscriptionsPage({ adminUser, onLogout }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [locations, setLocations] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [createDraft, setCreateDraft] = useState({
    baseType: "SERVICE",
    category: "WAX",
    gender: "FEMALE",
    locationId: "",
    baseServiceId: null,
    basePackageId: null,
    quantity: 5,
    discountPercent: 10,
    name: "",
    description: "",
    isVisible: true,
    showOnWebsite: true,
    showInBot: false,
    sortOrder: 0,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminSubscriptions();
      setItems(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить абонементы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openCreateForm = useCallback(async () => {
    setCreateError("");
    try {
      const locs = await getAdminLocations();
      setLocations(locs);
      setCreateDraft((prev) => ({
        ...prev,
        locationId: locs.length > 0 ? locs[0].id : "",
        baseServiceId: null,
        basePackageId: null,
        name: "",
      }));
      setShowCreate(true);
      setBaseOptions([]);
    } catch (e) {
      setCreateError(e.message || "Не удалось загрузить данные");
    }
  }, []);

  const loadBaseOptions = useCallback(async () => {
    if (!createDraft.category || !createDraft.locationId) {
      setBaseOptions([]);
      return;
    }
    const genderParam = createDraft.gender === "NONE" ? null : createDraft.gender;
    try {
      if (createDraft.baseType === "SERVICE") {
        const svc = await getAdminSubscriptionBaseServices({
          category: createDraft.category,
          gender: genderParam,
          locationId: createDraft.locationId,
        });
        setBaseOptions(svc);
      } else {
        const pkg = await getAdminSubscriptionBasePackages({
          category: createDraft.category,
          gender: genderParam,
          locationId: createDraft.locationId,
        });
        setBaseOptions(pkg);
      }
      setCreateDraft((prev) => ({ ...prev, baseServiceId: null, basePackageId: null }));
    } catch {
      setBaseOptions([]);
    }
  }, [createDraft.baseType, createDraft.category, createDraft.gender, createDraft.locationId]);

  useEffect(() => {
    if (showCreate) loadBaseOptions();
  }, [showCreate, loadBaseOptions]);

  const selectedBase = baseOptions.find(
    (b) => b.id === (createDraft.baseServiceId || createDraft.basePackageId)
  );

  const derivedFinalPrice = selectedBase
    ? Math.round(
        (selectedBase.price || 0) *
          createDraft.quantity *
          (1 - createDraft.discountPercent / 100)
      )
    : null;

  const defaultName =
    selectedBase && createDraft.quantity
      ? `Абонемент: ${selectedBase.name} × ${createDraft.quantity}`
      : "";

  const handleCreate = async () => {
    const nameVal = (createDraft.name ?? defaultName).trim();
    if (!nameVal) {
      setCreateError("Укажите название");
      return;
    }
    const baseId =
      createDraft.baseType === "SERVICE"
        ? createDraft.baseServiceId
        : createDraft.basePackageId;
    if (!baseId) {
      setCreateError("Выберите основу (услугу или комплекс)");
      return;
    }
    if (createDraft.quantity < 1) {
      setCreateError("Количество должно быть не меньше 1");
      return;
    }
    if (
      createDraft.discountPercent < 0 ||
      createDraft.discountPercent > 100
    ) {
      setCreateError("Скидка должна быть от 0 до 100%");
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      await createAdminSubscription({
        name: nameVal,
        description: createDraft.description || undefined,
        baseType: createDraft.baseType,
        baseServiceId:
          createDraft.baseType === "SERVICE" ? baseId : undefined,
        basePackageId:
          createDraft.baseType === "PACKAGE" ? baseId : undefined,
        quantity: createDraft.quantity,
        discountPercent: createDraft.discountPercent,
        isVisible: createDraft.isVisible,
        showOnWebsite: createDraft.showOnWebsite,
        showInBot: createDraft.showInBot,
        sortOrder: createDraft.sortOrder ?? 0,
      });
      setShowCreate(false);
      setCreateDraft({
        baseType: "SERVICE",
        category: "WAX",
        gender: "FEMALE",
        locationId: "",
        baseServiceId: null,
        basePackageId: null,
        quantity: 5,
        discountPercent: 10,
        name: "",
        description: "",
        isVisible: true,
        showOnWebsite: true,
        showInBot: false,
        sortOrder: 0,
      });
      await loadItems();
    } catch (e) {
      setCreateError(e.message || "Не удалось создать абонемент");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({
      name: item.name ?? "",
      description: item.description ?? "",
      quantity: item.quantity ?? 1,
      discountPercent: item.discountPercent ?? 0,
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
    const qty = Number(editDraft.quantity);
    if (isNaN(qty) || qty < 1) {
      setSaveError("Количество должно быть не меньше 1");
      return;
    }
    const disc = Number(editDraft.discountPercent);
    if (isNaN(disc) || disc < 0 || disc > 100) {
      setSaveError("Скидка должна быть от 0 до 100%");
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
      const res = await updateAdminSubscription(editingId, {
        name: nameVal,
        description: editDraft.description || null,
        quantity: qty,
        discountPercent: disc,
        isVisible: editDraft.isVisible,
        showOnWebsite: editDraft.showOnWebsite,
        showInBot: editDraft.showInBot,
        sortOrder: sortVal,
      });
      setEditingId(null);
      setEditDraft({});
      const updated = res?.subscription;
      if (updated) {
        setItems((prev) =>
          prev.map((i) => (i.id === editingId ? updated : i))
        );
      } else {
        await loadItems();
      }
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
      const res = await updateAdminSubscription(item.id, { [field]: next });
      const updated = res?.subscription;
      if (updated) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? updated : i))
        );
      } else {
        await loadItems();
      }
    } catch (e) {
      setError(e.message || "Не удалось изменить");
    } finally {
      setTogglingId(null);
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
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Абонементы</h1>
            <nav className="admin-nav">
              <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
              <button type="button" onClick={() => navigate("/admin/customers")} className="admin-nav-btn">Клиенты</button>
              <button type="button" onClick={() => navigate("/admin/catalog")} className="admin-nav-btn">Каталог</button>
              <button type="button" onClick={() => navigate("/admin/services")} className="admin-nav-btn">Услуги</button>
              <button type="button" onClick={() => navigate("/admin/packages")} className="admin-nav-btn">Комплексы</button>
              <button type="button" className="admin-nav-btn active">Абонементы</button>
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
          <div style={s.toolbarFilters} />
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={loadItems} style={s.refreshBtn} disabled={loading}>
              {loading ? "…" : "Обновить"}
            </button>
            <button
              onClick={openCreateForm}
              disabled={showCreate}
              style={{ ...s.refreshBtn, background: "#1a8c3a", color: "#fff", border: "none", fontWeight: 600 }}
            >
              Создать абонемент
            </button>
          </div>
        </div>

        {showCreate && (
          <section className="admin-card" style={{ ...s.content, marginBottom: 16, border: "2px solid #1a8c3a" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Новый абонемент</h3>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>1. Основа</div>
              <div style={s.createFieldRow}>
                <label style={s.toggleLabel}>
                  <input
                    type="radio"
                    name="baseType"
                    checked={createDraft.baseType === "SERVICE"}
                    onChange={() =>
                      setCreateDraft((p) => ({
                        ...p,
                        baseType: "SERVICE",
                        baseServiceId: null,
                        basePackageId: null,
                      }))
                    }
                    style={s.checkboxInput}
                  />
                  На основе услуги
                </label>
                <label style={s.toggleLabel}>
                  <input
                    type="radio"
                    name="baseType"
                    checked={createDraft.baseType === "PACKAGE"}
                    onChange={() =>
                      setCreateDraft((p) => ({
                        ...p,
                        baseType: "PACKAGE",
                        baseServiceId: null,
                        basePackageId: null,
                      }))
                    }
                    style={s.checkboxInput}
                  />
                  На основе комплекса
                </label>
              </div>
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>2. Параметры</div>
              <div style={s.createFieldRow}>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Тип процедуры</label>
                  <select
                    style={s.filterSelect}
                    value={createDraft.category}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        category: e.target.value,
                        baseServiceId: null,
                        basePackageId: null,
                      }))
                    }
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Пол</label>
                  <select
                    style={s.filterSelect}
                    value={createDraft.gender}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        gender: e.target.value,
                        baseServiceId: null,
                        basePackageId: null,
                      }))
                    }
                  >
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Локация</label>
                  <select
                    style={s.filterSelect}
                    value={createDraft.locationId}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        locationId: e.target.value,
                        baseServiceId: null,
                        basePackageId: null,
                      }))
                    }
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>3. Выбор основы</div>
              {baseOptions.length === 0 ? (
                <p style={s.subText}>Выберите тип процедуры, пол и локацию</p>
              ) : (
                <div style={s.serviceList}>
                  {baseOptions.map((option) => (
                    <label key={option.id} style={s.serviceCheckItem}>
                      <input
                        type="radio"
                        name="baseEntity"
                        checked={
                          (createDraft.baseType === "SERVICE" &&
                            createDraft.baseServiceId === option.id) ||
                          (createDraft.baseType === "PACKAGE" &&
                            createDraft.basePackageId === option.id)
                        }
                        onChange={() =>
                          setCreateDraft((p) => ({
                            ...p,
                            baseServiceId:
                              createDraft.baseType === "SERVICE"
                                ? option.id
                                : null,
                            basePackageId:
                              createDraft.baseType === "PACKAGE"
                                ? option.id
                                : null,
                            name:
                              createDraft.baseType === "SERVICE"
                                ? `Абонемент: ${option.name} × ${p.quantity}`
                                : `Абонемент: ${option.name} × ${p.quantity}`,
                          }))
                        }
                        style={s.checkboxInput}
                      />
                      <span>{option.name}</span>
                      <span style={s.serviceMeta}>
                        {option.durationMin} мин · {option.price} ₽
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>4. Параметры абонемента</div>
              <div style={s.createFieldRow}>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Количество</label>
                  <input
                    type="number"
                    min="1"
                    style={s.filterSelect}
                    value={createDraft.quantity}
                    onChange={(e) => {
                      const q = parseInt(e.target.value, 10) || 1;
                      setCreateDraft((p) => ({
                        ...p,
                        quantity: q,
                        name:
                          selectedBase && q
                            ? `Абонемент: ${selectedBase.name} × ${q}`
                            : p.name,
                      }));
                    }}
                  />
                </div>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Скидка %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    style={s.filterSelect}
                    value={createDraft.discountPercent}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        discountPercent: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>5. Предпросмотр</div>
              {selectedBase ? (
                <>
                  <p style={s.subText}>Основа: {selectedBase.name}</p>
                  <p style={s.subText}>
                    Цена: {selectedBase.price} ₽ × {createDraft.quantity} ={" "}
                    {selectedBase.price * createDraft.quantity} ₽
                  </p>
                  <p style={s.subText}>
                    Скидка: {createDraft.discountPercent}%
                  </p>
                  <p style={s.subText}>
                    <strong>Итоговая цена: {derivedFinalPrice} ₽</strong>
                  </p>
                </>
              ) : (
                <p style={s.subText}>Выберите основу</p>
              )}
            </div>

            <div style={s.createSection}>
              <div style={s.createSectionTitle}>6. Отображение</div>
              <div style={s.createFieldRow}>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Название</label>
                  <input
                    style={s.searchInput}
                    value={createDraft.name || defaultName}
                    onChange={(e) =>
                      setCreateDraft((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder={defaultName}
                  />
                </div>
              </div>
              <div style={s.createFieldRow}>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Описание</label>
                  <input
                    style={s.searchInput}
                    value={createDraft.description}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Описание (необязательно)"
                  />
                </div>
              </div>
              <div style={s.createFieldRow}>
                <label style={s.toggleLabel}>
                  <input
                    type="checkbox"
                    style={s.checkboxInput}
                    checked={createDraft.isVisible}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        isVisible: e.target.checked,
                      }))
                    }
                  />
                  Активен
                </label>
                <label style={s.toggleLabel}>
                  <input
                    type="checkbox"
                    style={s.checkboxInput}
                    checked={createDraft.showOnWebsite}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        showOnWebsite: e.target.checked,
                      }))
                    }
                  />
                  На сайте
                </label>
                <label style={s.toggleLabel}>
                  <input
                    type="checkbox"
                    style={s.checkboxInput}
                    checked={createDraft.showInBot}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        showInBot: e.target.checked,
                      }))
                    }
                  />
                  В боте
                </label>
              </div>
              <div style={s.createFieldRow}>
                <div style={s.createField}>
                  <label style={s.filterLabel}>Порядок</label>
                  <input
                    type="number"
                    min="0"
                    style={s.filterSelect}
                    value={createDraft.sortOrder}
                    onChange={(e) =>
                      setCreateDraft((p) => ({
                        ...p,
                        sortOrder: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {createError && <div style={s.saveError}>{createError}</div>}

            <div style={{ display: "flex", gap: "8px", marginTop: 16 }}>
              <button
                onClick={handleCreate}
                disabled={creating || !selectedBase}
                style={{
                  ...s.actionBtn,
                  background: "#1a8c3a",
                  padding: "8px 20px",
                  fontSize: "13px",
                }}
              >
                {creating ? "Создание…" : "Создать"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateError("");
                }}
                disabled={creating}
                style={{
                  ...s.actionBtn,
                  background: "#888",
                  padding: "8px 20px",
                  fontSize: "13px",
                }}
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
          ) : items.length === 0 ? (
            <p style={s.msg}>Нет абонементов.</p>
          ) : (
            <>
              <div style={s.count}>Абонементов: {items.length}</div>
              <div className="admin-table-wrap" style={s.tableWrap}>
                <table className="admin-table" style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Название</th>
                      <th style={s.th}>Основа</th>
                      <th style={s.th}>Тип процедуры</th>
                      <th style={s.th}>Пол</th>
                      <th style={s.th}>Количество</th>
                      <th style={s.th}>Скидка</th>
                      <th style={s.th}>Итоговая цена</th>
                      <th style={s.th}>Локация</th>
                      <th style={s.th}>На сайте</th>
                      <th style={s.th}>В боте</th>
                      <th style={s.th}>Активна в системе</th>
                      <th style={s.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
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
                              <input
                                style={{ ...s.editInput, marginTop: 4, maxWidth: "240px" }}
                                value={editDraft.description ?? ""}
                                onChange={(e) => handleDraftChange("description", e.target.value)}
                                placeholder="Описание"
                              />
                            </td>
                            <td style={s.td}>
                              {item.baseService?.name ?? item.basePackage?.name ?? "—"}
                            </td>
                            <td style={s.td}>
                              <span style={s.badge}>
                                {CATEGORY_LABELS[item.category] ?? item.category ?? "—"}
                              </span>
                            </td>
                            <td style={s.td}>{genderDisplay(item.gender)}</td>
                            <td style={s.td}>
                              <input
                                style={s.editInputNarrow}
                                type="number"
                                min="1"
                                value={editDraft.quantity}
                                onChange={(e) => handleDraftChange("quantity", e.target.value)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.editInputNarrow}
                                type="number"
                                min="0"
                                max="100"
                                value={editDraft.discountPercent}
                                onChange={(e) => handleDraftChange("discountPercent", e.target.value)}
                              />
                              %
                            </td>
                            <td style={s.td}>
                              <span style={s.readonlyValue}>
                                {item.finalPrice != null ? `${item.finalPrice} ₽` : "—"}
                              </span>
                              <span style={s.readonlyHint}>авто</span>
                            </td>
                            <td style={s.td}>{item.location?.name ?? "—"}</td>
                            <td style={s.td}>
                              <input
                                type="checkbox"
                                style={s.checkboxInput}
                                checked={editDraft.showOnWebsite ?? false}
                                onChange={(e) => handleDraftChange("showOnWebsite", e.target.checked)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                type="checkbox"
                                style={s.checkboxInput}
                                checked={editDraft.showInBot ?? false}
                                onChange={(e) => handleDraftChange("showInBot", e.target.checked)}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                type="checkbox"
                                style={s.checkboxInput}
                                checked={editDraft.isVisible ?? false}
                                onChange={(e) => handleDraftChange("isVisible", e.target.checked)}
                              />
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
                                <button
                                  type="button"
                                  onClick={handleSave}
                                  disabled={saving}
                                  style={{ ...s.actionBtn, background: "#1a8c3a" }}
                                >
                                  {saving ? "…" : "Сохранить"}
                                </button>
                                <button
                                  type="button"
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
                        <tr key={item.id} style={s.tr}>
                          <td style={s.td}>{item.name}</td>
                          <td style={s.td}>
                            {item.baseService?.name ?? item.basePackage?.name ?? "—"}
                          </td>
                          <td style={s.td}>
                            <span style={s.badge}>
                              {CATEGORY_LABELS[item.category] ?? item.category ?? "—"}
                            </span>
                          </td>
                          <td style={s.td}>{genderDisplay(item.gender)}</td>
                          <td style={s.td}>{item.quantity}</td>
                          <td style={s.td}>{item.discountPercent}%</td>
                          <td style={s.td}>
                            {item.finalPrice != null ? `${item.finalPrice} ₽` : "—"}
                          </td>
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "20px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700, color: "#111827" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  email: { fontSize: "14px", color: "#6b7280" },
  logoutBtn: {
    padding: "8px 16px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "13px",
    cursor: "pointer",
    color: "#374151",
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
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
    minWidth: "140px",
    background: "#fff",
  },
  searchInput: {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
    minWidth: "280px",
    background: "#fff",
    boxSizing: "border-box",
  },
  refreshBtn: {
    padding: "8px 16px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "13px",
    cursor: "pointer",
    color: "#374151",
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
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#374151",
    background: "#e5e7eb",
    whiteSpace: "nowrap",
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
  readonlyValue: { fontSize: "13px", color: "#374151" },
  readonlyHint: { display: "block", fontSize: "10px", color: "#9ca3af", marginTop: "2px" },
  actionBtn: {
    padding: "6px 12px",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
  },
  saveError: { fontSize: "11px", color: "#b91c1c", marginTop: "4px" },
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
