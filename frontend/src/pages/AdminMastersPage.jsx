import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  getAdminMasters,
  createAdminMaster,
  updateAdminMaster,
  getAdminServices,
} from "../api/admin.js";

const DAY_LABELS = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

const CATEGORY_ORDER = ["LASER", "WAX", "ELECTRO", "MASSAGE"];
const CATEGORY_LABEL = { LASER: "Лазер", WAX: "Воск", ELECTRO: "Электро", MASSAGE: "Массаж" };
const GENDER_ORDER = ["FEMALE", "MALE", "UNISEX", null];
const GENDER_LABEL = { FEMALE: "Женщины", MALE: "Мужчины", UNISEX: "Унисекс" };

function groupServices(services) {
  const catMap = new Map();
  for (const svc of services) {
    const cat = svc.category || "_NONE";
    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const gMap = catMap.get(cat);
    const g = svc.gender ?? "_NULL";
    if (!gMap.has(g)) gMap.set(g, []);
    gMap.get(g).push(svc);
  }
  const groups = [];
  const orderedCats = [...CATEGORY_ORDER.filter((c) => catMap.has(c)), ...([...catMap.keys()].filter((c) => !CATEGORY_ORDER.includes(c)))];
  for (const cat of orderedCats) {
    const gMap = catMap.get(cat);
    const orderedGenders = [...GENDER_ORDER.filter((g) => gMap.has(g ?? "_NULL")), ...([...gMap.keys()].filter((g) => !GENDER_ORDER.map((x) => x ?? "_NULL").includes(g)))];
    for (const g of orderedGenders) {
      const gKey = g ?? "_NULL";
      const svcs = gMap.get(gKey) || [];
      if (svcs.length === 0) continue;
      const catLabel = cat === "_NONE" ? "Без категории" : (CATEGORY_LABEL[cat] ?? cat);
      const gLabel = GENDER_LABEL[g] ?? (g === "_NULL" || g === null ? null : g);
      const heading = gLabel ? `${catLabel} — ${gLabel}` : catLabel;
      groups.push({ heading, services: svcs });
    }
  }
  return groups;
}

function GroupedServiceCheckboxes({ services, selectedIds, onToggle }) {
  const groups = groupServices(services);
  return (
    <div>
      {groups.map((group) => (
        <div key={group.heading} style={s.serviceGroup}>
          <div style={s.serviceGroupHeading}>{group.heading}</div>
          <div style={s.servicesList}>
            {group.services.map((svc) => (
              <label key={svc.id} style={s.serviceItem}>
                <input
                  type="checkbox"
                  style={s.checkbox}
                  checked={selectedIds.includes(svc.id)}
                  onChange={() => onToggle(svc.id)}
                />
                <span>{svc.name}</span>
                <span style={s.serviceMeta}>{svc.durationMin} мин · {svc.price} ₽</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminMastersPage({ adminUser, onLogout }) {
  const navigate = useNavigate();

  const [masters, setMasters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCreate());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [allServices, setAllServices] = useState([]);

  const loadMasters = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminMasters();
      setMasters(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить список мастеров");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasters();
    getAdminServices({ bookableOnly: true }).then(setAllServices).catch(() => {});
  }, [loadMasters]);

  // ── Create ─────────────────────────────────────────────

  function emptyCreate() {
    return { name: "", email: "", photoUrl: "", publicTitleRu: "", sortOrder: "0", serviceIds: [] };
  }

  const handleCreate = async () => {
    setCreateError("");
    const name = createDraft.name.trim();
    if (!name) { setCreateError("Укажите имя"); return; }
    const email = createDraft.email.trim();
    if (!email) { setCreateError("Укажите email"); return; }

    const sortVal = Number(createDraft.sortOrder);
    if (isNaN(sortVal) || sortVal < 0) { setCreateError("Порядок сортировки не меньше 0"); return; }

    setCreating(true);
    try {
      await createAdminMaster({
        name,
        email,
        photoUrl: createDraft.photoUrl.trim() || null,
        publicTitleRu: createDraft.publicTitleRu.trim() || null,
        sortOrder: sortVal,
        serviceIds: createDraft.serviceIds,
      });
      setShowCreate(false);
      setCreateDraft(emptyCreate());
      await loadMasters();
    } catch (e) {
      setCreateError(e.message || "Не удалось создать мастера");
    } finally {
      setCreating(false);
    }
  };

  // ── Edit ───────────────────────────────────────────────

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditDraft({
      name: m.name,
      photoUrl: m.photoUrl ?? "",
      publicTitleRu: m.publicTitleRu ?? "",
      isActive: m.isActive,
      isVisibleOnWebsite: m.isVisibleOnWebsite,
      sortOrder: String(m.sortOrder),
      serviceIds: m.serviceIds ?? [],
      workingHours: (m.workingHours || []).map((wh) => ({
        dayOfWeek: wh.dayOfWeek,
        startTime: wh.startTime || "09:00",
        endTime: wh.endTime || "18:00",
      })),
      exceptions: (m.exceptions || []).map((e) =>
        e.dateTo
          ? { type: "VACATION", dateFrom: e.date, dateTo: e.dateTo }
          : { type: "DAY_OFF", date: e.date },
      ),
    });
    setSaveError("");
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft({}); setSaveError(""); };

  const handleDraftChange = (field, value) => {
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveError("");
    const name = editDraft.name.trim();
    if (!name) { setSaveError("Укажите имя"); setSaving(false); return; }

    const sortVal = Number(editDraft.sortOrder);
    if (isNaN(sortVal) || sortVal < 0) { setSaveError("Порядок сортировки не меньше 0"); setSaving(false); return; }

    setSaving(true);
    try {
      const exceptionsPayload = (editDraft.exceptions || [])
        .filter((ex) =>
          ex.type === "DAY_OFF" ? ex.date : ex.dateFrom && ex.dateTo && ex.dateFrom <= ex.dateTo,
        )
        .map((ex) =>
          ex.type === "DAY_OFF"
            ? { type: "DAY_OFF", date: ex.date }
            : { type: "VACATION", dateFrom: ex.dateFrom, dateTo: ex.dateTo },
        );
      await updateAdminMaster(editingId, {
        name,
        photoUrl: editDraft.photoUrl.trim() || null,
        publicTitleRu: editDraft.publicTitleRu.trim() || null,
        isActive: editDraft.isActive,
        isVisibleOnWebsite: editDraft.isVisibleOnWebsite,
        sortOrder: sortVal,
        serviceIds: editDraft.serviceIds,
        workingHours: (editDraft.workingHours || []).map((wh) => ({
          dayOfWeek: wh.dayOfWeek,
          startTime: wh.startTime,
          endTime: wh.endTime,
        })),
        exceptions: exceptionsPayload,
      });
      setEditingId(null);
      setEditDraft({});
      await loadMasters();
    } catch (e) {
      setSaveError(e.message || "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (m, field) => {
    try {
      await updateAdminMaster(m.id, { [field]: !m[field] });
      await loadMasters();
    } catch (e) {
      alert(e.message || "Ошибка");
    }
  };

  const toggleServiceId = (list, id) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const workingHoursList = editDraft.workingHours || [];
  const addWorkingHourRow = () => {
    handleDraftChange("workingHours", [...workingHoursList, { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" }]);
  };
  const removeWorkingHourRow = (index) => {
    handleDraftChange("workingHours", workingHoursList.filter((_, i) => i !== index));
  };
  const updateWorkingHourRow = (index, field, value) => {
    const next = workingHoursList.map((row, i) =>
      i === index ? { ...row, [field]: value } : row,
    );
    handleDraftChange("workingHours", next);
  };

  const exceptionsList = editDraft.exceptions || [];
  const addException = (type) => {
    if (type === "DAY_OFF") {
      handleDraftChange("exceptions", [...exceptionsList, { type: "DAY_OFF", date: "" }]);
    } else {
      handleDraftChange("exceptions", [...exceptionsList, { type: "VACATION", dateFrom: "", dateTo: "" }]);
    }
  };
  const removeException = (index) => {
    handleDraftChange("exceptions", exceptionsList.filter((_, i) => i !== index));
  };
  const updateException = (index, field, value) => {
    const next = exceptionsList.map((row, i) =>
      i === index ? { ...row, [field]: value } : row,
    );
    handleDraftChange("exceptions", next);
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
            <h1 style={s.title}>Мастера</h1>
            <nav className="admin-nav">
              <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
              <button type="button" onClick={() => navigate("/admin/catalog")} className="admin-nav-btn">Каталог</button>
              <button type="button" onClick={() => navigate("/admin/services")} className="admin-nav-btn">Услуги</button>
              <button type="button" onClick={() => navigate("/admin/packages")} className="admin-nav-btn">Комплексы</button>
              <button type="button" onClick={() => navigate("/admin/subscriptions")} className="admin-nav-btn">Абонементы</button>
              <button type="button" onClick={() => navigate("/admin/zones")} className="admin-nav-btn">Зоны</button>
              <button type="button" className="admin-nav-btn active">Мастера</button>
            </nav>
          </div>
          <div style={s.headerRight}>
            <span style={s.email}>{adminUser?.email}</span>
            <button type="button" onClick={handleLogout} className="admin-logout-btn" style={s.logoutBtn}>Выйти</button>
          </div>
        </header>

        {/* Toolbar */}
        <div style={s.toolbar}>
          <button
            onClick={() => { setShowCreate(!showCreate); setCreateError(""); }}
            style={s.addBtn}
          >
            {showCreate ? "Отмена" : "+ Новый мастер"}
          </button>
          <button onClick={loadMasters} disabled={loading} style={s.refreshBtn}>
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="admin-card" style={s.createForm}>
            <h3 style={s.createTitle}>Новый мастер</h3>
            <div style={s.createGrid}>
              <label style={s.fieldLabel}>
                Имя *
                <input style={s.input} value={createDraft.name}
                  onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })} />
              </label>
              <label style={s.fieldLabel}>
                Email *
                <input style={s.input} type="email" value={createDraft.email}
                  onChange={(e) => setCreateDraft({ ...createDraft, email: e.target.value })} />
              </label>
              <label style={s.fieldLabel}>
                Фото URL
                <input style={s.input} value={createDraft.photoUrl}
                  onChange={(e) => setCreateDraft({ ...createDraft, photoUrl: e.target.value })}
                  placeholder="https://..." />
              </label>
              <label style={s.fieldLabel}>
                Должность на сайте
                <input style={s.input} value={createDraft.publicTitleRu}
                  onChange={(e) => setCreateDraft({ ...createDraft, publicTitleRu: e.target.value })}
                  placeholder="Например: Депиляция" />
              </label>
              <label style={s.fieldLabel}>
                Порядок (0, 1, 2…)
                <input style={s.input} type="number" min="0" value={createDraft.sortOrder}
                  onChange={(e) => setCreateDraft({ ...createDraft, sortOrder: e.target.value })} />
              </label>
            </div>
            {allServices.length > 0 && (
              <div style={s.servicesSection}>
                <p style={s.servicesTitle}>Услуги мастера</p>
                <GroupedServiceCheckboxes
                  services={allServices}
                  selectedIds={createDraft.serviceIds}
                  onToggle={(id) => setCreateDraft((prev) => ({
                    ...prev,
                    serviceIds: toggleServiceId(prev.serviceIds, id),
                  }))}
                />
              </div>
            )}
            {createError && <p style={s.formError}>{createError}</p>}
            <button onClick={handleCreate} disabled={creating} style={s.createBtn}>
              {creating ? "Создание…" : "Создать"}
            </button>
          </div>
        )}

        {/* Content */}
        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#b91c1c" }}>{error}</p>
          ) : masters.length === 0 ? (
            <p style={s.msg}>Нет мастеров. Добавьте первого.</p>
          ) : (
            <>
              <div style={s.count}>Мастеров: {masters.length}</div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={s.th}>Имя</th>
                      <th style={s.th}>Должность</th>
                      <th style={s.th}>Фото</th>
                      <th style={s.th}>В записи</th>
                      <th style={s.th}>На сайте</th>
                      <th style={s.th}>Порядок</th>
                      <th style={s.th}>Услуги</th>
                      <th style={s.th}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masters.map((m) => {
                      const isEditing = editingId === m.id;

                      if (isEditing) {
                        return (
                          <React.Fragment key={m.id}>
                            <tr style={s.trEditing}>
                              <td style={s.td}>
                                <input style={s.editInput} value={editDraft.name}
                                  onChange={(e) => handleDraftChange("name", e.target.value)} />
                              </td>
                              <td style={s.td}>
                                <input style={s.editInput} value={editDraft.publicTitleRu}
                                  onChange={(e) => handleDraftChange("publicTitleRu", e.target.value)}
                                  placeholder="—" />
                              </td>
                              <td style={s.td}>
                                <input style={{ ...s.editInput, maxWidth: "200px" }} value={editDraft.photoUrl}
                                  onChange={(e) => handleDraftChange("photoUrl", e.target.value)}
                                  placeholder="https://..." />
                              </td>
                              <td style={s.td} title="Участвует в записи через бота">
                                <input type="checkbox" checked={editDraft.isActive}
                                  onChange={(e) => handleDraftChange("isActive", e.target.checked)}
                                  style={s.checkbox} />
                              </td>
                              <td style={s.td} title="Показывать на публичном сайте">
                                <input type="checkbox" checked={editDraft.isVisibleOnWebsite}
                                  onChange={(e) => handleDraftChange("isVisibleOnWebsite", e.target.checked)}
                                  style={s.checkbox} />
                              </td>
                              <td style={s.td}>
                                <input style={{ ...s.editInput, width: "55px" }} type="number" min="0"
                                  value={editDraft.sortOrder}
                                  onChange={(e) => handleDraftChange("sortOrder", e.target.value)} />
                              </td>
                              <td style={s.td}>
                                <div style={s.actions}>
                                  <button onClick={handleSave} disabled={saving}
                                    style={{ ...s.actionBtn, background: "#1a8c3a" }}>
                                    {saving ? "…" : "Сохранить"}
                                  </button>
                                  <button onClick={cancelEdit} disabled={saving}
                                    style={{ ...s.actionBtn, background: "#888" }}>
                                    Отмена
                                  </button>
                                </div>
                                {saveError && <div style={s.saveError}>{saveError}</div>}
                              </td>
                            </tr>
                            {allServices.length > 0 && (
                              <tr style={s.trEditing}>
                                <td colSpan={8} style={s.td}>
                                  <div style={s.servicesSection}>
                                    <p style={s.servicesTitle}>Услуги мастера</p>
                                    <GroupedServiceCheckboxes
                                      services={allServices}
                                      selectedIds={editDraft.serviceIds || []}
                                      onToggle={(id) => handleDraftChange(
                                        "serviceIds",
                                        toggleServiceId(editDraft.serviceIds || [], id),
                                      )}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                            <tr style={s.trEditing}>
                              <td colSpan={8} style={s.td}>
                                <div style={s.workingHoursSection}>
                                  <p style={s.servicesTitle}>Рабочие часы</p>
                                  {workingHoursList.map((row, idx) => (
                                    <div key={idx} style={s.workingHourRow}>
                                      <select
                                        style={{ ...s.input, ...s.workingHourSelect }}
                                        value={row.dayOfWeek}
                                        onChange={(e) => updateWorkingHourRow(idx, "dayOfWeek", Number(e.target.value))}
                                      >
                                        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                                          <option key={d} value={d}>{DAY_LABELS[d]}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="text"
                                        style={{ ...s.editInput, ...s.timeInput }}
                                        placeholder="09:00"
                                        value={row.startTime}
                                        onChange={(e) => updateWorkingHourRow(idx, "startTime", e.target.value)}
                                      />
                                      <span style={s.timeSep}>–</span>
                                      <input
                                        type="text"
                                        style={{ ...s.editInput, ...s.timeInput }}
                                        placeholder="18:00"
                                        value={row.endTime}
                                        onChange={(e) => updateWorkingHourRow(idx, "endTime", e.target.value)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeWorkingHourRow(idx)}
                                        style={s.removeRowBtn}
                                        title="Удалить"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={addWorkingHourRow} style={s.addRowBtn}>
                                    Добавить рабочий день
                                  </button>
                                </div>
                              </td>
                            </tr>
                            <tr style={s.trEditing}>
                              <td colSpan={8} style={s.td}>
                                <div style={s.workingHoursSection}>
                                  <p style={s.servicesTitle}>Выходные и отпуска</p>
                                  {exceptionsList.map((ex, idx) => (
                                    <div key={idx} style={s.workingHourRow}>
                                      <span style={s.exceptionTypeLabel}>
                                        {ex.type === "DAY_OFF" ? "Выходной" : "Отпуск"}
                                      </span>
                                      {ex.type === "DAY_OFF" ? (
                                        <input
                                          type="date"
                                          style={{ ...s.input, ...s.timeInput }}
                                          value={ex.date}
                                          onChange={(e) => updateException(idx, "date", e.target.value)}
                                        />
                                      ) : (
                                        <>
                                          <input
                                            type="date"
                                            style={{ ...s.input, ...s.timeInput }}
                                            value={ex.dateFrom}
                                            onChange={(e) => updateException(idx, "dateFrom", e.target.value)}
                                            placeholder="Начало"
                                          />
                                          <span style={s.timeSep}>–</span>
                                          <input
                                            type="date"
                                            style={{ ...s.input, ...s.timeInput }}
                                            value={ex.dateTo}
                                            onChange={(e) => updateException(idx, "dateTo", e.target.value)}
                                            placeholder="Конец"
                                          />
                                        </>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => removeException(idx)}
                                        style={s.removeRowBtn}
                                        title="Удалить"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                  <div style={s.exceptionAddRow}>
                                    <button type="button" onClick={() => addException("DAY_OFF")} style={s.addRowBtn}>
                                      Добавить выходной
                                    </button>
                                    <button type="button" onClick={() => addException("VACATION")} style={s.addRowBtn}>
                                      Добавить отпуск
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      }

                      return (
                        <tr key={m.id} style={{ ...s.tr, opacity: m.isActive ? 1 : 0.5 }}>
                          <td style={s.td}>
                            <div style={s.nameCell}>
                              {m.photoUrl ? (
                                <img src={m.photoUrl} alt="" style={s.avatar} />
                              ) : (
                                <div style={s.avatarPlaceholder}>
                                  {(m.name || "?").charAt(0)}
                                </div>
                              )}
                              <span>{m.name}</span>
                            </div>
                          </td>
                          <td style={s.td}>{m.publicTitleRu || <span style={s.subText}>—</span>}</td>
                          <td style={s.td}>
                            <span style={s.urlText} title={m.photoUrl || ""}>
                              {m.photoUrl ? truncate(m.photoUrl, 30) : "—"}
                            </span>
                          </td>
                          <td style={s.td}>
                            <button onClick={() => handleToggle(m, "isActive")} style={s.toggleBtn}
                              title={m.isActive ? "Исключить из записи" : "Включить в запись"}>
                              {m.isActive ? "✅" : "❌"}
                            </button>
                          </td>
                          <td style={s.td}>
                            <button onClick={() => handleToggle(m, "isVisibleOnWebsite")} style={s.toggleBtn}
                              title={m.isVisibleOnWebsite ? "Скрыть с сайта" : "Показать на сайте"}>
                              {m.isVisibleOnWebsite ? "👁" : "🚫"}
                            </button>
                          </td>
                          <td style={s.td}>{m.sortOrder}</td>
                          <td style={s.td}>
                            <span style={s.serviceCount}>
                              {(m.serviceIds?.length || 0) > 0
                                ? `${m.serviceIds.length} услуг`
                                : <span style={s.subText}>—</span>}
                            </span>
                          </td>
                          <td style={s.td}>
                            <button onClick={() => startEdit(m)} disabled={editingId !== null}
                              style={{ ...s.actionBtn, background: "#3366cc" }}>
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

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + "…" : str;
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
    display: "flex", gap: "12px", marginBottom: "24px", alignItems: "center",
  },
  addBtn: {
    padding: "8px 16px", border: "none", borderRadius: "8px",
    background: "#2563eb", color: "#fff", fontSize: "13px", fontWeight: 600,
    cursor: "pointer",
  },
  refreshBtn: {
    padding: "8px 14px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
    marginLeft: "auto",
  },
  createForm: {
    marginBottom: "24px", padding: "20px",
  },
  createTitle: { margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" },
  createGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
  },
  fieldLabel: {
    display: "flex", flexDirection: "column", gap: "4px",
    fontSize: "12px", fontWeight: 600, color: "#6b7280",
  },
  input: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", background: "#fff",
  },
  formError: { color: "#b91c1c", fontSize: "13px", marginTop: "8px" },
  createBtn: {
    marginTop: "12px", padding: "8px 20px", border: "none", borderRadius: "8px",
    background: "#2563eb", color: "#fff", fontSize: "13px", fontWeight: 600,
    cursor: "pointer",
  },
  content: { padding: "24px", marginBottom: "24px" },
  msg: { color: "#6b7280", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  count: { fontSize: "13px", color: "#6b7280", marginBottom: "12px" },
  th: {},
  tr: { borderBottom: "1px solid #f3f4f6" },
  trEditing: { background: "#f9fafb" },
  td: {},
  nameCell: { display: "flex", alignItems: "center", gap: "8px" },
  avatar: {
    width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover",
  },
  avatarPlaceholder: {
    width: "32px", height: "32px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f0e6ef", color: "#8b5c88", fontSize: "14px", fontWeight: 700,
    flexShrink: 0,
  },
  subText: { fontSize: "13px", color: "#999" },
  urlText: { fontSize: "12px", color: "#999", wordBreak: "break-all" },
  toggleBtn: {
    background: "none", border: "none", fontSize: "18px", cursor: "pointer",
    padding: "2px 6px",
  },
  editInput: {
    padding: "5px 8px", border: "1px solid #ccc", borderRadius: "4px",
    fontSize: "13px", width: "100%", boxSizing: "border-box",
  },
  checkbox: { width: "18px", height: "18px", cursor: "pointer" },
  actions: { display: "flex", gap: "6px", flexWrap: "wrap" },
  actionBtn: {
    padding: "5px 12px", border: "none", borderRadius: "6px",
    fontSize: "12px", fontWeight: 600, color: "#fff", cursor: "pointer",
    whiteSpace: "nowrap",
  },
  saveError: { fontSize: "11px", color: "#c44", marginTop: "4px" },
  serviceCount: { fontSize: "13px", color: "#555" },
  servicesSection: { marginTop: "8px" },
  servicesTitle: {
    margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "#555",
  },
  serviceGroup: {
    marginBottom: "12px",
  },
  serviceGroupHeading: {
    fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase",
    letterSpacing: "0.04em", borderBottom: "1px solid #e5e7eb",
    paddingBottom: "4px", marginBottom: "6px",
  },
  servicesList: {
    display: "flex", flexWrap: "wrap", gap: "4px 16px",
  },
  serviceItem: {
    display: "flex", alignItems: "center", gap: "6px",
    fontSize: "13px", color: "#333", cursor: "pointer", whiteSpace: "nowrap",
  },
  serviceMeta: { fontSize: "11px", color: "#999" },
  workingHoursSection: { marginTop: "12px" },
  workingHourRow: {
    display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap",
  },
  workingHourSelect: { minWidth: "140px" },
  timeInput: { width: "70px" },
  timeSep: { fontSize: "14px", color: "#888" },
  removeRowBtn: {
    padding: "4px 8px", border: "none", borderRadius: "4px",
    background: "#eee", color: "#c44", cursor: "pointer", fontSize: "14px",
  },
  addRowBtn: {
    marginTop: "4px", padding: "6px 12px", border: "1px dashed #999", borderRadius: "6px",
    background: "#fff", fontSize: "13px", color: "#555", cursor: "pointer",
  },
  exceptionTypeLabel: { fontSize: "13px", fontWeight: 600, color: "#555", minWidth: "70px" },
  exceptionAddRow: { display: "flex", gap: "8px", marginTop: "8px" },
};
