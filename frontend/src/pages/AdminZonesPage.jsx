import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogout, getAdminZones, createAdminZone, updateAdminZone } from "../api/admin.js";

const ZONES_TOOLTIP = "Зоны — это справочник семантических зон, которые используются при создании услуг и комплексов.";
const ZONEKEY_HELP = "Системный ключ зоны. После сохранения изменить нельзя.";
const CONFIRM_MESSAGE = "Вы создаёте системный ключ зоны.\nПосле сохранения изменить его будет нельзя.\nПроверьте, что ключ введён верно.";

export function AdminZonesPage({ adminUser, onLogout }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    labelRu: "",
    zoneKey: "",
    isActive: true,
    sortOrder: "0",
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminZones();
      setItems(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить зоны");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleCreateDraftChange = (field, value) => {
    if (field === "zoneKey") {
      value = value.toLowerCase().replace(/[^a-z0-9-]/g, (c) => (c === " " ? "-" : ""));
    }
    setCreateDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateSubmit = () => {
    const labelVal = (createDraft.labelRu ?? "").trim();
    const keyVal = (createDraft.zoneKey ?? "").trim();
    if (!labelVal) { setCreateError("Укажите название зоны"); return; }
    if (!keyVal) { setCreateError("Укажите ключ зоны"); return; }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(keyVal)) {
      setCreateError("Ключ: только строчные буквы, цифры и дефисы (например: upper-lip)");
      return;
    }
    setCreateError("");
    setShowConfirm(true);
  };

  const handleCreateConfirm = async () => {
    setShowConfirm(false);
    const labelVal = (createDraft.labelRu ?? "").trim();
    const keyVal = (createDraft.zoneKey ?? "").trim();
    const sortVal = parseInt(createDraft.sortOrder, 10) || 0;

    setCreating(true);
    setCreateError("");
    try {
      await createAdminZone({
        zoneKey: keyVal,
        labelRu: labelVal,
        isActive: createDraft.isActive,
        sortOrder: sortVal,
      });
      setShowCreate(false);
      setCreateDraft({ labelRu: "", zoneKey: "", isActive: true, sortOrder: "0" });
      await loadItems();
    } catch (e) {
      setCreateError(e.message || "Не удалось создать зону");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({
      labelRu: item.labelRu ?? "",
      isActive: item.isActive ?? true,
      sortOrder: item.sortOrder != null ? String(item.sortOrder) : "0",
    });
    setSaveError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setSaveError("");
  };

  const handleSave = async () => {
    const labelVal = (editDraft.labelRu ?? "").trim();
    if (!labelVal) { setSaveError("Укажите название"); return; }
    const sortVal = parseInt(editDraft.sortOrder, 10);
    if (isNaN(sortVal) || sortVal < 0) { setSaveError("Порядок >= 0"); return; }

    setSaving(true);
    setSaveError("");
    try {
      await updateAdminZone(editingId, {
        labelRu: labelVal,
        isActive: editDraft.isActive,
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

  const handleLogout = () => {
    adminLogout();
    onLogout();
    navigate("/admin/login", { replace: true });
  };

  const navBtn = (path, label, active) => (
    <button
      type="button"
      onClick={() => navigate(path)}
      className={`admin-nav-btn ${active ? "active" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <div className="admin-layout" style={s.wrapper}>
      <div className="admin-container" style={s.container}>
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>
              Зоны
              <span style={s.tooltipIcon} title={ZONES_TOOLTIP}>
                ⓘ
              </span>
            </h1>
            <nav className="admin-nav">
              {navBtn("/admin/bookings", "Записи", false)}
              {navBtn("/admin/catalog", "Каталог", false)}
              {navBtn("/admin/services", "Услуги", false)}
              {navBtn("/admin/packages", "Комплексы", false)}
              {navBtn("/admin/zones", "Зоны", true)}
              {navBtn("/admin/masters", "Мастера", false)}
            </nav>
          </div>
          <div style={s.headerRight}>
            <span style={s.email}>{adminUser?.email}</span>
            <button type="button" onClick={handleLogout} className="admin-logout-btn" style={s.logoutBtn}>
              Выйти
            </button>
          </div>
        </header>

        {showCreate && (
          <section className="admin-card" style={{ ...s.content, marginBottom: 16, border: "2px solid #1a8c3a" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>
              Новая зона
            </h3>
            <div style={s.formRow}>
              <div style={s.formField}>
                <label style={s.filterLabel}>Название зоны</label>
                <input
                  style={s.searchInput}
                  value={createDraft.labelRu}
                  onChange={(e) => handleCreateDraftChange("labelRu", e.target.value)}
                  placeholder="Например: Верхняя губа"
                />
              </div>
              <div style={s.formField}>
                <label style={s.filterLabel}>Ключ зоны</label>
                <input
                  style={s.searchInput}
                  value={createDraft.zoneKey}
                  onChange={(e) => handleCreateDraftChange("zoneKey", e.target.value)}
                  placeholder="Например: upper-lip"
                />
                <div style={s.helpText}>{ZONEKEY_HELP}</div>
              </div>
              <div style={s.formField}>
                <label style={s.filterLabel}>Порядок</label>
                <input
                  style={s.editInputNarrow}
                  type="number"
                  min="0"
                  value={createDraft.sortOrder}
                  onChange={(e) => handleCreateDraftChange("sortOrder", e.target.value)}
                />
              </div>
              <div style={s.formField}>
                <label style={s.filterLabel}>&nbsp;</label>
                <label style={s.toggleLabel}>
                  <input
                    type="checkbox"
                    style={s.checkboxInput}
                    checked={createDraft.isActive}
                    onChange={(e) => handleCreateDraftChange("isActive", e.target.checked)}
                  />
                  Активна
                </label>
              </div>
            </div>
            {createError && <div style={s.saveError}>{createError}</div>}
            <div style={{ display: "flex", gap: "8px", marginTop: 16 }}>
              <button
                onClick={handleCreateSubmit}
                disabled={creating}
                style={{ ...s.actionBtn, background: "#1a8c3a", padding: "8px 20px", fontSize: "13px" }}
              >
                Сохранить
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(""); setShowConfirm(false); }}
                disabled={creating}
                style={{ ...s.actionBtn, background: "#888", padding: "8px 20px", fontSize: "13px" }}
              >
                Отмена
              </button>
            </div>
          </section>
        )}

        {showConfirm && (
          <div style={s.modalOverlay} onClick={() => setShowConfirm(false)}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <p style={s.modalText}>{CONFIRM_MESSAGE}</p>
              <div style={s.modalActions}>
                <button
                  onClick={handleCreateConfirm}
                  disabled={creating}
                  style={{ ...s.actionBtn, background: "#1a8c3a" }}
                >
                  {creating ? "…" : "Продолжить"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={creating}
                  style={{ ...s.actionBtn, background: "#888" }}
                >
                  Вернуться к редактированию
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={s.toolbar}>
          <button
            onClick={() => { setShowCreate(true); setCreateError(""); setCreateDraft({ labelRu: "", zoneKey: "", isActive: true, sortOrder: "0" }); }}
            disabled={showCreate}
            style={{ ...s.refreshBtn, background: "#1a8c3a", color: "#fff", border: "none", fontWeight: 600 }}
          >
            Создать зону
          </button>
        </div>

        <section className="admin-card" style={s.content}>
          {loading ? (
            <p style={s.msg}>Загрузка…</p>
          ) : error ? (
            <p style={{ ...s.msg, color: "#b91c1c" }}>{error}</p>
          ) : items.length === 0 ? (
            <p style={s.msg}>Нет зон. Создайте первую зону.</p>
          ) : (
            <>
              <div style={s.count}>Зон: {items.length}</div>
              <div className="admin-table-wrap" style={s.tableWrap}>
                <table className="admin-table" style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Название</th>
                      <th style={s.th}>Ключ</th>
                      <th style={s.th}>Активна</th>
                      <th style={s.th}>Порядок</th>
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
                                value={editDraft.labelRu}
                                onChange={(e) => setEditDraft((p) => ({ ...p, labelRu: e.target.value }))}
                                placeholder="Название"
                              />
                            </td>
                            <td style={s.td}>
                              <span style={s.readonlyKey}>{item.zoneKey}</span>
                            </td>
                            <td style={s.td}>
                              <input
                                type="checkbox"
                                style={s.checkboxInput}
                                checked={editDraft.isActive}
                                onChange={(e) => setEditDraft((p) => ({ ...p, isActive: e.target.checked }))}
                              />
                            </td>
                            <td style={s.td}>
                              <input
                                style={s.editInputNarrow}
                                type="number"
                                min="0"
                                value={editDraft.sortOrder}
                                onChange={(e) => setEditDraft((p) => ({ ...p, sortOrder: e.target.value }))}
                              />
                            </td>
                            <td style={s.td}>
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
                          <td style={s.td}>{item.labelRu}</td>
                          <td style={s.td}>
                            <code style={s.zoneKeyCode}>{item.zoneKey}</code>
                          </td>
                          <td style={s.td}>{item.isActive ? "✅" : "—"}</td>
                          <td style={s.td}>{item.sortOrder}</td>
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
  title: { margin: 0, fontSize: "24px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" },
  tooltipIcon: {
    cursor: "help",
    fontSize: "16px",
    color: "#6b7280",
    opacity: 0.8,
  },
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
  toolbar: { display: "flex", gap: "8px", marginBottom: "20px" },
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
  trEditing: { borderBottom: "1px solid #e5e7eb", background: "#f8fafc" },
  editInput: {
    padding: "6px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    width: "100%",
    maxWidth: "200px",
    boxSizing: "border-box",
  },
  editInputNarrow: {
    padding: "6px 8px",
    border: "1px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    width: "72px",
    boxSizing: "border-box",
  },
  checkboxInput: { width: "16px", height: "16px", cursor: "pointer", margin: 0 },
  toggleLabel: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" },
  formRow: { display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" },
  formField: { display: "flex", flexDirection: "column", gap: "4px" },
  filterLabel: { fontSize: "12px", fontWeight: 600, color: "#6b7280" },
  searchInput: {
    padding: "8px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
    minWidth: "180px",
    background: "#fff",
    boxSizing: "border-box",
  },
  helpText: { fontSize: "11px", color: "#6b7280", marginTop: "4px" },
  actions: { display: "flex", gap: "6px", flexWrap: "wrap" },
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
  zoneKeyCode: { fontFamily: "monospace", fontSize: "12px", background: "#f3f4f6", padding: "2px 6px", borderRadius: "4px" },
  readonlyKey: { fontFamily: "monospace", fontSize: "12px", color: "#6b7280" },
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
