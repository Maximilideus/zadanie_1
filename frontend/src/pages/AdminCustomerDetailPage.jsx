import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  adminLogout,
  getAdminCustomer,
  updateAdminCustomer,
  getAdminServices,
  getAdminMasters,
  getAdminAvailability,
  createAdminBooking,
} from "../api/admin.js";

const STATUS_LABELS = {
  PENDING: "Ожидает",
  CONFIRMED: "Подтверждена",
  CANCELLED: "Отменена",
  COMPLETED: "Завершена",
};

const SOURCE_LABELS = {
  BOT: "Бот",
  ADMIN: "Админ",
};

const SERVICE_CATEGORY_OPTIONS = [
  { value: "LASER", label: "Лазер" },
  { value: "WAX", label: "Воск" },
  { value: "ELECTRO", label: "Электро" },
  { value: "MASSAGE", label: "Массаж" },
  { value: "OTHER", label: "Прочее" },
];

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ELECTRO time: "Electro 45 min" -> "Электро - 45 минут" */
function formatBookingServiceLabel(service) {
  if (!service?.name) return "—";
  const m = /^Electro\s+(\d+)\s*min$/i.exec(service.name.trim());
  if (m) return `Электро - ${m[1]} минут`;
  return service.name;
}

export function AdminCustomerDetailPage({ adminUser, onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showNewBooking, setShowNewBooking] = useState(false);
  const [services, setServices] = useState([]);
  const [masters, setMasters] = useState([]);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newServiceId, setNewServiceId] = useState("");
  const [newMasterId, setNewMasterId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);

  useEffect(() => {
    if (!createSuccess) return;
    const t = setTimeout(() => setCreateSuccess(false), 4000);
    return () => clearTimeout(t);
  }, [createSuccess]);

  const loadCustomer = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminCustomer(id);
      setCustomer(data);
      setEditName(data.name ?? "");
      setEditPhone(data.phone ?? "");
      setEditNotes(data.notes ?? "");
    } catch (e) {
      setError(e.message || "Не удалось загрузить клиента");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  useEffect(() => {
    if (showNewBooking && services.length === 0) {
      getAdminServices({ bookableOnly: true }).then(setServices).catch(() => setServices([]));
    }
    if (showNewBooking && masters.length === 0) {
      getAdminMasters().then(setMasters).catch(() => setMasters([]));
    }
  }, [showNewBooking, services.length, masters.length]);

  const servicesInCategory = useMemo(() => {
    if (!newCategoryId) return [];
    if (newCategoryId === "OTHER") return services.filter((s) => !s.category);
    return services.filter((s) => s.category === newCategoryId);
  }, [services, newCategoryId]);

  const mastersForService = useMemo(() => {
    if (!newServiceId) return masters;
    return masters.filter((m) => Array.isArray(m.serviceIds) && m.serviceIds.includes(newServiceId));
  }, [masters, newServiceId]);

  useEffect(() => {
    if (!newServiceId || !newMasterId) return;
    const canDo = mastersForService.some((m) => m.id === newMasterId);
    if (!canDo) setNewMasterId("");
  }, [newServiceId, mastersForService, newMasterId]);

  const dateMinMax = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const max = new Date(today);
    max.setDate(max.getDate() + 60);
    return { min: tomorrow.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
  }, []);

  const loadSlots = async () => {
    if (!newServiceId || !newMasterId || !newDate) return;
    setSlotsLoading(true);
    setSlotsError("");
    setSlots([]);
    setSelectedSlot(null);
    try {
      const data = await getAdminAvailability({ serviceId: newServiceId, masterId: newMasterId, date: newDate });
      setSlots(data.slots ?? []);
      if ((data.slots ?? []).length === 0) {
        const reason = data.unavailableReason;
        if (reason === "NO_WORKING_HOURS") setSlotsError("Мастер не работает в этот день.");
        else if (reason === "NO_FREE_SLOTS") setSlotsError("Нет свободных слотов на выбранную дату.");
        else setSlotsError("На эту дату нет доступных слотов.");
      }
    } catch (e) {
      setSlotsError(e.message || "Не удалось загрузить слоты");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!id || !newServiceId || !newMasterId || !selectedSlot) return;
    setCreateLoading(true);
    setCreateError("");
    setCreateSuccess(false);
    try {
      await createAdminBooking({
        customerId: id,
        serviceId: newServiceId,
        masterId: newMasterId,
        scheduledAt: selectedSlot,
      });
      setCreateSuccess(true);
      setShowNewBooking(false);
      setNewCategoryId("");
      setNewServiceId("");
      setNewMasterId("");
      setNewDate("");
      setSlots([]);
      setSelectedSlot(null);
      await loadCustomer();
    } catch (e) {
      setCreateError(e.message || "Не удалось создать запись");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError("");
    try {
      await updateAdminCustomer(id, {
        name: editName.trim() || undefined,
        phone: editPhone.trim() || null,
        notes: editNotes.trim() || null,
      });
      await loadCustomer();
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

  const bookings = customer?.bookings ?? [];
  const now = new Date();

  const futureBookings = bookings.filter((b) => b.scheduledAt && new Date(b.scheduledAt) > now);
  const pastBookings = bookings.filter((b) => b.scheduledAt && new Date(b.scheduledAt) <= now);

  const nearestFuture =
    futureBookings.length > 0
      ? futureBookings.reduce((a, b) =>
          new Date(b.scheduledAt) < new Date(a.scheduledAt) ? b : a
        )
      : null;
  const latestPast =
    pastBookings.length > 0
      ? pastBookings.reduce((a, b) =>
          new Date(b.scheduledAt) > new Date(a.scheduledAt) ? b : a
        )
      : null;

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
    cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
    nearestFuture,
    latestPast,
  };

  if (loading) {
    return (
      <div className="admin-layout" style={s.wrapper}>
        <div className="admin-container" style={s.container}>
          <header style={s.header}>
            <div style={s.headerLeft}>
              <h1 style={s.title}>Клиент</h1>
              <nav className="admin-nav">
                <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
                <button type="button" onClick={() => navigate("/admin/customers")} className="admin-nav-btn">Клиенты</button>
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
          <section className="admin-card" style={s.content}>
            <p style={s.msg}>Загрузка…</p>
          </section>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="admin-layout" style={s.wrapper}>
        <div className="admin-container" style={s.container}>
          <header style={s.header}>
            <div style={s.headerLeft}>
              <h1 style={s.title}>Клиент</h1>
              <nav className="admin-nav">
                <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
                <button type="button" onClick={() => navigate("/admin/customers")} className="admin-nav-btn">Клиенты</button>
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
          <section className="admin-card" style={s.content}>
            <p style={{ ...s.msg, color: "#c44" }}>{error || "Клиент не найден"}</p>
            <button type="button" onClick={() => navigate("/admin/customers")} style={s.backBtn}>
              ← Назад к клиентам
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout" style={s.wrapper}>
      <div className="admin-container" style={s.container}>
        <header style={s.header}>
          <div style={s.headerLeft}>
            <h1 style={s.title}>Клиент</h1>
            <nav className="admin-nav">
              <button type="button" onClick={() => navigate("/admin/bookings")} className="admin-nav-btn">Записи</button>
              <button type="button" onClick={() => navigate("/admin/customers")} className="admin-nav-btn">Клиенты</button>
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

        <div style={s.backLinkWrap}>
          <button type="button" onClick={() => navigate("/admin/customers")} style={s.backBtn}>
            ← Назад к клиентам
          </button>
        </div>

        <section className="admin-card" style={s.content}>
          <h2 style={s.sectionTitle}>Информация</h2>
          <div style={s.infoGrid}>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Имя клиента</span>
              <span style={s.infoValue}>{customer.name || "—"}</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Телефон</span>
              <span style={s.infoValue}>{customer.phone || "—"}</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Telegram username</span>
              <span style={s.infoValue}>
                {customer.telegramUsername ? `@${customer.telegramUsername}` : "—"}
              </span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Telegram ID</span>
              <span style={s.infoValue}>{customer.telegramId || "—"}</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Создан</span>
              <span style={s.infoValue}>{formatDateTime(customer.createdAt)}</span>
            </div>
            <div style={s.infoRow}>
              <span style={s.infoLabel}>Обновлён</span>
              <span style={s.infoValue}>{formatDateTime(customer.updatedAt)}</span>
            </div>
          </div>
        </section>

        <section className="admin-card" style={s.content}>
          <h2 style={s.sectionTitle}>Статистика</h2>
          <div style={s.statsGrid}>
            <div style={s.statItem}>
              <span style={s.statLabel}>Всего записей</span>
              <span style={s.statValue}>{stats.total}</span>
            </div>
            <div style={s.statItem}>
              <span style={s.statLabel}>Подтверждено</span>
              <span style={s.statValue}>{stats.confirmed}</span>
            </div>
            <div style={s.statItem}>
              <span style={s.statLabel}>Отменено</span>
              <span style={s.statValue}>{stats.cancelled}</span>
            </div>
            <div style={s.statItem}>
              <span style={s.statLabel}>Ближайшая запись</span>
              <span style={s.statValue}>
                {stats.nearestFuture
                  ? formatDateTime(stats.nearestFuture.scheduledAt)
                  : "—"}
              </span>
            </div>
            <div style={s.statItem}>
              <span style={s.statLabel}>Последняя запись</span>
              <span style={s.statValue}>
                {stats.latestPast
                  ? formatDateTime(stats.latestPast.scheduledAt)
                  : "—"}
              </span>
            </div>
          </div>
        </section>

        <section className="admin-card" style={s.content}>
          <h2 style={s.sectionTitle}>Редактирование</h2>
          <div style={s.editForm}>
            <div style={s.editRow}>
              <label style={s.editLabel}>Имя</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={s.editInput}
                placeholder="Имя клиента"
              />
            </div>
            <div style={s.editRow}>
              <label style={s.editLabel}>Телефон</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                style={s.editInput}
                placeholder="+7 900 123 45 67"
              />
            </div>
            <div style={s.editRow}>
              <label style={s.editLabel}>Заметки</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                style={s.editTextarea}
                placeholder="Заметки о клиенте"
                rows={3}
              />
            </div>
            {saveError && <p style={s.saveError}>{saveError}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={s.saveBtn}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </section>

        <section className="admin-card" style={s.content}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={s.sectionTitle}>История записей</h2>
            <button
              type="button"
              onClick={() => { setShowNewBooking(!showNewBooking); setCreateError(""); setSlotsError(""); setCreateSuccess(false); }}
              style={s.newBookingBtn}
            >
              {showNewBooking ? "Отмена" : "Новая запись"}
            </button>
          </div>
          {createSuccess && <p style={s.successMsg}>Запись успешно создана.</p>}
          {showNewBooking && (
            <div style={s.newBookingForm}>
              <div style={s.editRow}>
                <label style={s.editLabel}>Категория услуги</label>
                <select
                  value={newCategoryId}
                  onChange={(e) => {
                    setNewCategoryId(e.target.value);
                    setNewServiceId("");
                    setNewMasterId("");
                    setSlots([]);
                    setSelectedSlot(null);
                  }}
                  style={s.editInput}
                >
                  <option value="">Выберите категорию</option>
                  {SERVICE_CATEGORY_OPTIONS.filter((opt) => {
                    if (opt.value === "OTHER") return services.some((s) => !s.category);
                    return services.some((s) => s.category === opt.value);
                  }).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div style={s.editRow}>
                <label style={s.editLabel}>Услуга</label>
                <select
                  value={newServiceId}
                  onChange={(e) => { setNewServiceId(e.target.value); setSlots([]); setSelectedSlot(null); }}
                  style={s.editInput}
                  disabled={!newCategoryId}
                >
                  <option value="">{newCategoryId ? "Выберите услугу" : "Сначала выберите категорию"}</option>
                  {servicesInCategory.map((sv) => (
                    <option key={sv.id} value={sv.id}>{sv.name}{sv.durationMin != null ? ` (${sv.durationMin} мин)` : ""}</option>
                  ))}
                </select>
              </div>
              <div style={s.editRow}>
                <label style={s.editLabel}>Мастер</label>
                <select
                  value={newMasterId}
                  onChange={(e) => { setNewMasterId(e.target.value); setSlots([]); setSelectedSlot(null); }}
                  style={s.editInput}
                  disabled={!newServiceId}
                >
                  <option value="">{newServiceId ? (mastersForService.length === 0 ? "Нет мастеров для этой услуги" : "Выберите мастера") : "Сначала выберите услугу"}</option>
                  {mastersForService.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={s.editRow}>
                <label style={s.editLabel}>Дата</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => { setNewDate(e.target.value); setSlots([]); setSelectedSlot(null); }}
                  style={s.editInput}
                  min={dateMinMax.min}
                  max={dateMinMax.max}
                  title={`Доступна запись со следующего дня до ${dateMinMax.max}`}
                />
              </div>
              <button
                type="button"
                onClick={loadSlots}
                disabled={!newServiceId || !newMasterId || !newDate || slotsLoading}
                style={s.secondaryBtn}
              >
                {slotsLoading ? "Загрузка…" : "Загрузить слоты"}
              </button>
              {slotsError && <p style={s.saveError}>{slotsError}</p>}
              {slots.length > 0 && (
                <>
                  <p style={s.slotLabel}>Выберите время:</p>
                  <div style={s.slotGrid}>
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        style={selectedSlot === slot ? s.slotBtnSelected : s.slotBtn}
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {selectedSlot && (
                <>
                  <p style={s.summaryText}>
                    {formatDate(selectedSlot)}, {formatTime(selectedSlot)} — {services.find((s) => s.id === newServiceId)?.name ?? ""} — {masters.find((m) => m.id === newMasterId)?.name ?? ""}
                  </p>
                  {createError && <p style={s.saveError}>{createError}</p>}
                  <button
                    type="button"
                    onClick={handleCreateBooking}
                    disabled={createLoading}
                    style={s.saveBtn}
                  >
                    {createLoading ? "Создание…" : "Создать запись"}
                  </button>
                </>
              )}
            </div>
          )}

          {!showNewBooking && (bookings.length === 0 ? (
            <p style={s.msg}>У клиента пока нет записей.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={s.th}>Дата</th>
                    <th style={s.th}>Время</th>
                    <th style={s.th}>Запись</th>
                    <th style={s.th}>Мастер</th>
                    <th style={s.th}>Статус</th>
                    <th style={s.th}>Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} style={s.tr}>
                      <td style={s.td}>{formatDate(b.scheduledAt)}</td>
                      <td style={s.td}>{formatTime(b.scheduledAt)}</td>
                      <td style={s.td}>{formatBookingServiceLabel(b.service)}</td>
                      <td style={s.td}>{b.master?.name || "—"}</td>
                      <td style={s.td}>
                        <span className={`admin-status-badge admin-status-${(b.status || "").toLowerCase()}`}>
                          {STATUS_LABELS[b.status] || b.status || "—"}
                        </span>
                      </td>
                      <td style={s.td}>
                        {b.source ? (SOURCE_LABELS[b.source] ?? b.source) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
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
  backLinkWrap: { marginBottom: "16px" },
  backBtn: {
    padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
  },
  content: { padding: "24px", marginBottom: "24px" },
  sectionTitle: { margin: "0 0 16px", fontSize: "16px", fontWeight: 700, color: "#111827" },
  msg: { color: "#6b7280", fontSize: "15px", padding: "32px 0" },
  infoGrid: { display: "flex", flexDirection: "column", gap: "8px" },
  infoRow: { display: "flex", gap: "12px", alignItems: "baseline" },
  infoLabel: { fontSize: "13px", color: "#6b7280", minWidth: "140px" },
  infoValue: { fontSize: "14px", color: "#111827" },
  statsGrid: { display: "flex", flexWrap: "wrap", gap: "24px" },
  statItem: { display: "flex", flexDirection: "column", gap: "4px" },
  statLabel: { fontSize: "12px", color: "#6b7280" },
  statValue: { fontSize: "15px", fontWeight: 600, color: "#111827" },
  editForm: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" },
  editRow: { display: "flex", flexDirection: "column", gap: "4px" },
  editLabel: { fontSize: "12px", fontWeight: 600, color: "#6b7280" },
  editInput: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px",
  },
  editTextarea: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "8px",
    fontSize: "14px", resize: "vertical",
  },
  saveError: { color: "#c44", fontSize: "13px", margin: 0 },
  saveBtn: {
    padding: "10px 20px", border: "none", borderRadius: "8px",
    background: "#1a8c3a", color: "#fff", fontSize: "14px", fontWeight: 600,
    cursor: "pointer", alignSelf: "flex-start",
  },
  newBookingBtn: {
    padding: "8px 16px", border: "1px solid #1a8c3a", borderRadius: "8px",
    background: "#fff", color: "#1a8c3a", fontSize: "14px", fontWeight: 600,
    cursor: "pointer",
  },
  newBookingForm: { display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px", marginBottom: "16px" },
  secondaryBtn: {
    padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: "8px",
    background: "#fff", fontSize: "14px", cursor: "pointer", alignSelf: "flex-start",
  },
  slotLabel: { fontSize: "13px", fontWeight: 600, color: "#374151", margin: "8px 0 4px" },
  slotGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  slotBtn: {
    padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "6px",
    background: "#fff", fontSize: "13px", cursor: "pointer",
  },
  slotBtnSelected: {
    padding: "8px 12px", border: "2px solid #1a8c3a", borderRadius: "6px",
    background: "#f0fdf4", fontSize: "13px", cursor: "pointer",
  },
  summaryText: { fontSize: "14px", color: "#374151", margin: "8px 0" },
  successMsg: { color: "#1a8c3a", fontSize: "14px", marginBottom: "8px" },
  th: {},
  tr: {},
  td: {},
};
