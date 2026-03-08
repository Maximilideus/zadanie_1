import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogout,
  getAdminMasters,
  createAdminMaster,
  updateAdminMaster,
  getAdminServices,
} from "../api/admin.js";

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
      setError(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasters();
    getAdminServices().then(setAllServices).catch(() => {});
  }, [loadMasters]);

  // ── Create ─────────────────────────────────────────────

  function emptyCreate() {
    return { name: "", email: "", photoUrl: "", publicTitleRu: "", sortOrder: "0", serviceIds: [] };
  }

  const handleCreate = async () => {
    setCreateError("");
    const name = createDraft.name.trim();
    if (!name) { setCreateError("Имя обязательно"); return; }
    const email = createDraft.email.trim();
    if (!email) { setCreateError("Email обязателен"); return; }

    const sortVal = Number(createDraft.sortOrder);
    if (isNaN(sortVal) || sortVal < 0) { setCreateError("Порядок >= 0"); return; }

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
      setCreateError(e.message || "Ошибка создания");
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
    if (!name) { setSaveError("Имя обязательно"); setSaving(false); return; }

    const sortVal = Number(editDraft.sortOrder);
    if (isNaN(sortVal) || sortVal < 0) { setSaveError("Порядок >= 0"); setSaving(false); return; }

    setSaving(true);
    try {
      await updateAdminMaster(editingId, {
        name,
        photoUrl: editDraft.photoUrl.trim() || null,
        publicTitleRu: editDraft.publicTitleRu.trim() || null,
        isActive: editDraft.isActive,
        isVisibleOnWebsite: editDraft.isVisibleOnWebsite,
        sortOrder: sortVal,
        serviceIds: editDraft.serviceIds,
      });
      setEditingId(null);
      setEditDraft({});
      await loadMasters();
    } catch (e) {
      setSaveError(e.message || "Ошибка сохранения");
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

  const handleLogout = () => {
    adminLogout();
    onLogout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div style={s.wrapper}>
      <div style={s.container}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Мастера</h1>
            <nav style={s.nav}>
              <button onClick={() => navigate("/admin/bookings")} style={s.navBtn}>Записи</button>
              <button onClick={() => navigate("/admin/catalog")} style={s.navBtn}>Каталог</button>
              <button style={{ ...s.navBtn, ...s.navBtnActive }}>Мастера</button>
            </nav>
          </div>
          <div style={s.headerRight}>
            <span style={s.email}>{adminUser?.email}</span>
            <button onClick={handleLogout} style={s.logoutBtn}>Выйти</button>
          </div>
        </header>

        {/* Toolbar */}
        <div style={s.toolbar}>
          <button
            onClick={() => { setShowCreate(!showCreate); setCreateError(""); }}
            style={s.addBtn}
          >
            {showCreate ? "Отмена" : "+ Добавить мастера"}
          </button>
          <button onClick={loadMasters} disabled={loading} style={s.refreshBtn}>
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={s.createForm}>
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
                Публичная должность
                <input style={s.input} value={createDraft.publicTitleRu}
                  onChange={(e) => setCreateDraft({ ...createDraft, publicTitleRu: e.target.value })}
                  placeholder="Депиляция" />
              </label>
              <label style={s.fieldLabel}>
                Порядок сортировки
                <input style={s.input} type="number" min="0" value={createDraft.sortOrder}
                  onChange={(e) => setCreateDraft({ ...createDraft, sortOrder: e.target.value })} />
              </label>
            </div>
            {allServices.length > 0 && (
              <div style={s.servicesSection}>
                <p style={s.servicesTitle}>Услуги мастера</p>
                <div style={s.servicesList}>
                  {allServices.map((svc) => (
                    <label key={svc.id} style={s.serviceItem}>
                      <input type="checkbox" style={s.checkbox}
                        checked={createDraft.serviceIds.includes(svc.id)}
                        onChange={() => setCreateDraft((prev) => ({
                          ...prev,
                          serviceIds: toggleServiceId(prev.serviceIds, svc.id),
                        }))} />
                      <span>{svc.name}</span>
                      <span style={s.serviceMeta}>{svc.durationMin} мин · {svc.price} ₽</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {createError && <p style={s.formError}>{createError}</p>}
            <button onClick={handleCreate} disabled={creating} style={s.createBtn}>
              {creating ? "Создание…" : "Создать мастера"}
            </button>
          </div>
        )}

        {/* Content */}
        <section style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#c44" }}>{error}</p>
          ) : masters.length === 0 ? (
            <p style={s.msg}>Мастера не найдены.</p>
          ) : (
            <>
              <div style={s.count}>Всего мастеров: {masters.length}</div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Имя</th>
                      <th style={s.th}>Должность</th>
                      <th style={s.th}>Фото URL</th>
                      <th style={s.th}>Актив.</th>
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
                              <td style={s.td}>
                                <input type="checkbox" checked={editDraft.isActive}
                                  onChange={(e) => handleDraftChange("isActive", e.target.checked)}
                                  style={s.checkbox} />
                              </td>
                              <td style={s.td}>
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
                                    <div style={s.servicesList}>
                                      {allServices.map((svc) => (
                                        <label key={svc.id} style={s.serviceItem}>
                                          <input type="checkbox" style={s.checkbox}
                                            checked={(editDraft.serviceIds || []).includes(svc.id)}
                                            onChange={() => handleDraftChange(
                                              "serviceIds",
                                              toggleServiceId(editDraft.serviceIds || [], svc.id),
                                            )} />
                                          <span>{svc.name}</span>
                                          <span style={s.serviceMeta}>{svc.durationMin} мин · {svc.price} ₽</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
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
                              title={m.isActive ? "Деактивировать" : "Активировать"}>
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
                                ? `${m.serviceIds.length} усл.`
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
  wrapper: { minHeight: "100vh", background: "#f5f5f5" },
  container: { maxWidth: "1300px", margin: "0 auto", padding: "24px 16px" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "20px",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "20px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700, color: "#1a1a1a" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  email: { fontSize: "14px", color: "#666" },
  logoutBtn: {
    padding: "8px 16px", border: "1px solid #ddd", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#333",
  },
  nav: { display: "flex", gap: "4px" },
  navBtn: {
    padding: "6px 14px", border: "1px solid #ddd", borderRadius: "6px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#555",
  },
  navBtnActive: {
    background: "#1a1a1a", color: "#fff", borderColor: "#1a1a1a",
  },
  toolbar: {
    display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center",
  },
  addBtn: {
    padding: "8px 16px", border: "none", borderRadius: "8px",
    background: "#1a8c3a", color: "#fff", fontSize: "13px", fontWeight: 600,
    cursor: "pointer",
  },
  refreshBtn: {
    padding: "8px 14px", border: "1px solid #ddd", borderRadius: "6px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#333",
    marginLeft: "auto",
  },
  createForm: {
    marginBottom: "20px", padding: "20px", background: "#fff",
    borderRadius: "12px", boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  createTitle: { margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#1a1a1a" },
  createGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px",
  },
  fieldLabel: {
    display: "flex", flexDirection: "column", gap: "4px",
    fontSize: "12px", fontWeight: 600, color: "#666",
  },
  input: {
    padding: "8px 10px", border: "1px solid #ddd", borderRadius: "6px",
    fontSize: "14px", background: "#fff",
  },
  formError: { color: "#c44", fontSize: "13px", marginTop: "8px" },
  createBtn: {
    marginTop: "12px", padding: "8px 20px", border: "none", borderRadius: "8px",
    background: "#1a8c3a", color: "#fff", fontSize: "13px", fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    background: "#fff", borderRadius: "12px", padding: "24px",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  msg: { color: "#888", fontSize: "15px", textAlign: "center", padding: "32px 0" },
  count: { fontSize: "13px", color: "#999", marginBottom: "12px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  th: {
    textAlign: "left", padding: "10px 10px", borderBottom: "2px solid #eee",
    fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase",
    letterSpacing: "0.5px", whiteSpace: "nowrap",
  },
  tr: { borderBottom: "1px solid #f0f0f0" },
  trEditing: { borderBottom: "1px solid #f0f0f0", background: "#fafafa" },
  td: { padding: "8px 10px", verticalAlign: "middle" },
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
  servicesList: {
    display: "flex", flexWrap: "wrap", gap: "6px 16px",
  },
  serviceItem: {
    display: "flex", alignItems: "center", gap: "6px",
    fontSize: "13px", color: "#333", cursor: "pointer", whiteSpace: "nowrap",
  },
  serviceMeta: { fontSize: "11px", color: "#999" },
};
