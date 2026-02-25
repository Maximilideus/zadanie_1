import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceSelector } from "./components/ServiceSelector.jsx";
import { MasterSelector } from "./components/MasterSelector.jsx";
import { DateSelector } from "./components/DateSelector.jsx";
import { TimeSlots } from "./components/TimeSlots.jsx";
import { Summary } from "./components/Summary.jsx";
import { AuthForm } from "./components/AuthForm.jsx";
import { LandingPage } from "./components/LandingPage.jsx";
import { showSuccessToast, showErrorToast } from "./components/CustomToast.jsx";
import { supabase } from "./supabase.js";

const BASE_SLOTS = [
  "10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00",
];

export const SERVICES = {
  laser_depilation:    { label: "Лазерная депиляция",     price: 2500, durations: [30, 60, 90] },
  electric_depilation: { label: "Электрическая депиляция", price: 1800, durations: [30, 60] },
  wax_depilation:      { label: "Восковая депиляция",      price: 1200, durations: [30, 60] },
  neck_massage:        { label: "Массаж шеи",              price: 1500, durations: [30, 60] },
  back_massage:        { label: "Массаж спины",            price: 2000, durations: [60, 90] },
  full_body_massage:   { label: "Массаж всего тела",       price: 3500, durations: [60, 90] },
};

export const MASTERS_DATA = {
  "Анна":    { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Anna",   rating: 4.9, specialization: "Депиляция" },
  "Мария":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Maria",  rating: 4.7, specialization: "Депиляция" },
  "Елена":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Elena",  rating: 4.8, specialization: "Массаж и депиляция" },
  "Дмитрий": { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Dmitry", rating: 4.6, specialization: "Массаж" },
};

export const MASTERS_BY_SERVICE = {
  laser_depilation:    ["Анна", "Мария"],
  electric_depilation: ["Мария"],
  wax_depilation:      ["Анна", "Елена"],
  neck_massage:        ["Елена", "Дмитрий"],
  back_massage:        ["Дмитрий"],
  full_body_massage:   ["Елена", "Дмитрий"],
};

const HOURS_UNTIL_RATE = 24;

function getTodayStr() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, "0");
  const dd   = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateForSummary(dateStr) {
  if (!dateStr) return "не выбрано";
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

export function getServiceLabel(value) {
  if (!value) return "не выбрано";
  return SERVICES[value]?.label ?? "не выбрано";
}

function canRateBooking(booking) {
  const raw = booking.created_at ?? booking.createdAt;
  if (!raw) return true;
  const created = new Date(raw);
  if (isNaN(created.getTime())) return true;
  const diffHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return diffHours >= HOURS_UNTIL_RATE;
}

function timeToMinutes(time) {
  if (!time || typeof time !== "string" || !time.includes(":")) return -1;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function buildSlotsForDate(dateStr, todayStr, masterValue, history) {
  if (!dateStr) {
    return BASE_SLOTS.map((time) => ({ time, isPast: false, isBooked: false }));
  }

  const isToday = dateStr === todayStr;
  const now = new Date();
  now.setSeconds(0, 0);

  const masterBookings = masterValue
    ? history.filter(
        (item) => !item.cancelled && item.master === masterValue && item.date === dateStr
      )
    : [];

  return BASE_SLOTS.map((time) => {
    const slotStart = timeToMinutes(time);
    const isBooked  = masterBookings.some((item) => {
      const itemStart = timeToMinutes(item.time);
      const itemEnd   = itemStart + (item.duration ?? 60);
      return slotStart >= itemStart && slotStart < itemEnd;
    });

    let isPast = false;
    if (isToday) {
      const [hours, minutes] = time.split(":").map(Number);
      const slotDate = new Date();
      slotDate.setHours(hours, minutes, 0, 0);
      if (slotDate < now) isPast = true;
    }

    return { time, isPast, isBooked };
  });
}

export function calcRating(masterName, ratingsMap) {
  const scores = ratingsMap[masterName];
  if (!Array.isArray(scores) || scores.length === 0) {
    return MASTERS_DATA[masterName]?.rating ?? null;
  }
  const valid = scores.filter((s) => typeof s === "number" && s >= 1 && s <= 5);
  if (valid.length === 0) return MASTERS_DATA[masterName]?.rating ?? null;
  const avg = valid.reduce((sum, s) => sum + s, 0) / valid.length;
  return Math.round(avg * 10) / 10;
}

export function App() {
  const todayStr = useMemo(() => getTodayStr(), []);

  // undefined = ещё проверяем сессию, null = не авторизован, object = авторизован
  const [session,     setSession]     = useState(undefined);
  const [showBooking, setShowBooking] = useState(false); // false = лендинг, true = форма записи
  const [formData,    setFormData]    = useState({
    service: "", master: "", date: todayStr, selectedSlot: null, duration: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [history,      setHistory]      = useState([]);
  const [ratingsMap,   setRatingsMap]   = useState({});

  const serviceSelectRef = useRef(null);

  // ─── Следим за сессией ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const availableMasters   = useMemo(() => MASTERS_BY_SERVICE[formData.service] ?? [], [formData.service]);
  const availableDurations = useMemo(() => SERVICES[formData.service]?.durations ?? [], [formData.service]);
  const servicePrice       = useMemo(() => SERVICES[formData.service]?.price ?? null, [formData.service]);

  const slots = useMemo(
    () => buildSlotsForDate(formData.date, todayStr, formData.master, history),
    [formData.date, todayStr, formData.master, history]
  );

  const summaryService  = getServiceLabel(formData.service);
  const summaryMaster   = formData.master || "не выбрано";
  const summaryDate     = formatDateForSummary(formData.date);
  const summaryTime     = formData.selectedSlot || "не выбрано";
  const summaryDuration = formData.duration ? `${formData.duration} мин` : "не выбрано";
  const summaryPrice    = servicePrice ? `${servicePrice.toLocaleString("ru-RU")} ₽` : "не выбрано";

  // ─── Загрузка данных — только когда пользователь авторизован ─────────────
  useEffect(() => {
    if (!session) return; // не авторизован — не грузим

    async function loadData() {
      setIsLoading(true);
      try {
        // Только свои записи — RLS автоматически фильтрует по user_id
        const { data: bookings, error: bookingsError } = await supabase
          .from("bookings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        if (bookingsError) throw bookingsError;
        if (bookings) setHistory(bookings);

        // Оценки всех мастеров — общие для всех пользователей
        const { data: ratings, error: ratingsError } = await supabase
          .from("master_ratings")
          .select("master_name, score");

        if (ratingsError) throw ratingsError;

        if (ratings) {
          const map = {};
          ratings.forEach(({ master_name, score }) => {
            if (!map[master_name]) map[master_name] = [];
            map[master_name].push(score);
          });
          setRatingsMap(map);
        }
      } catch (e) {
        console.error("Ошибка загрузки данных:", e);
        showErrorToast("Не удалось загрузить данные.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [session]); // перезагружаем при входе/выходе

  // ─── Создание записи ──────────────────────────────────────────────────────
  const handleConfirm = async (event) => {
    if (isSubmitting) return;
    event.preventDefault();

    const problems = [];
    if (!formData.service)                        problems.push("Выберите услугу.");
    if (!formData.master)                         problems.push("Выберите мастера.");
    if (!formData.duration)                       problems.push("Выберите длительность.");
    if (!formData.date || !formData.selectedSlot) problems.push("Выберите дату и время.");
    if (problems.length > 0) { showErrorToast(problems.join(" ")); return; }

    const isDuplicate = history.some(
      (item) =>
        !item.cancelled &&
        item.service === summaryService &&
        item.master  === formData.master &&
        item.date    === formData.date &&
        item.time    === formData.selectedSlot
    );
    if (isDuplicate) {
      showErrorToast(`Вы уже записаны на ${summaryService} к ${formData.master} на ${summaryDate} в ${formData.selectedSlot}.`);
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        id:        Date.now().toString(),
        service:   summaryService,
        master:    formData.master,
        date:      formData.date,
        time:      formData.selectedSlot,
        duration:  formData.duration,
        price:     servicePrice,
        cancelled: false,
        rated:     false,
        user_id:   session.user.id, // привязываем к текущему пользователю
      })
      .select()
      .single();

    if (error) {
      console.error("Ошибка сохранения:", error);
      showErrorToast("Не удалось создать запись. Попробуйте ещё раз.");
      setIsSubmitting(false);
      return;
    }

    setHistory((prev) => [data, ...prev].slice(0, 5));
    showSuccessToast(`Запись создана: ${summaryService}, ${formData.master}, ${summaryDate}, ${formData.selectedSlot}.`);
    setFormData({ service: "", master: "", date: todayStr, selectedSlot: null, duration: null });
    if (serviceSelectRef.current) serviceSelectRef.current.focus();
    window.setTimeout(() => setIsSubmitting(false), 1500);
  };

  // ─── Отмена записи ────────────────────────────────────────────────────────
  const handleCancelBooking = async (bookingId) => {
    const { error } = await supabase
      .from("bookings")
      .update({ cancelled: true })
      .eq("id", bookingId);

    if (error) { showErrorToast("Не удалось отменить запись."); return; }
    setHistory((prev) => prev.map((item) => item.id === bookingId ? { ...item, cancelled: true } : item));
    showSuccessToast("Запись отменена.");
  };

  // ─── Оценка мастера ───────────────────────────────────────────────────────
  const handleRateMaster = async (bookingId, masterName, score) => {
    const { error: ratingError } = await supabase
      .from("master_ratings")
      .insert({ master_name: masterName, score, booking_id: bookingId });

    if (ratingError) { showErrorToast("Не удалось сохранить оценку."); return; }

    await supabase.from("bookings").update({ rated: true }).eq("id", bookingId);

    setHistory((prev) => prev.map((item) => item.id === bookingId ? { ...item, rated: true } : item));
    setRatingsMap((prev) => ({
      ...prev,
      [masterName]: [...(prev[masterName] ?? []), score],
    }));
    showSuccessToast(`Спасибо за оценку! ${masterName} получает ваши ★`);
  };

  // ─── Выход из аккаунта ────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setHistory([]);
    setRatingsMap({});
  };

  const handleServiceChange   = (value) => setFormData((prev) => ({ ...prev, service: value, master: "", duration: null }));
  const handleMasterChange    = (value) => setFormData((prev) => ({ ...prev, master: value }));
  const handleDateChange      = (value) => {
    if (value < todayStr) { showErrorToast("Нельзя записаться на прошедшую дату."); return; }
    setFormData((prev) => ({ ...prev, date: value, selectedSlot: null }));
  };
  const handleSlotSelect      = (time) => setFormData((prev) => ({ ...prev, selectedSlot: time }));
  const handleDurationChange  = (dur)  => setFormData((prev) => ({ ...prev, duration: dur }));
  const handleBookedSlotClick = ()     => showErrorToast("Это время уже занято. Пожалуйста, выберите другой слот.");

  // ─── Пока проверяем сессию — пустой экран ────────────────────────────────
  if (session === undefined) return null;

  // ─── Лендинг — стартовый экран ────────────────────────────────────────────
  if (!showBooking) {
    return <LandingPage onBook={() => setShowBooking(true)} />;
  }

  // ─── Не авторизован — форма входа ─────────────────────────────────────────
  if (!session) {
    return <AuthForm onBack={() => setShowBooking(false)} />;
  }

  // ─── Авторизован — форма записи ───────────────────────────────────────────
  return (
    <div className="root-bg">
      <main className="page">
        <section className="card" aria-label="Форма онлайн-записи в салон красоты">
          <form onSubmit={handleConfirm}>
            <header className="card-header">
              <div className="header-top">
                <h1 className="title">Запись на услугу</h1>
                {/* Email пользователя + кнопка выхода */}
                <div className="user-info">
                  <span className="user-email">{session.user.email}</span>
                  <button type="button" className="signout-btn" onClick={handleSignOut}>
                    Выйти
                  </button>
                </div>
              </div>
              <p className="subtitle">Выберите процедуру, дату и удобное время.</p>
            </header>

            <ServiceSelector value={formData.service} onChange={handleServiceChange} selectRef={serviceSelectRef} />

            {formData.service && availableDurations.length > 0 && (
              <div className="duration-selector">
                <div className="section-label">Длительность</div>
                <div className="duration-options">
                  {availableDurations.map((d) => (
                    <button key={d} type="button"
                      className={`duration-btn${formData.duration === d ? " selected" : ""}`}
                      onClick={() => handleDurationChange(d)}
                    >
                      {d} мин
                    </button>
                  ))}
                </div>
              </div>
            )}

            <MasterSelector value={formData.master} masters={availableMasters} onChange={handleMasterChange} ratingsMap={ratingsMap} />
            <DateSelector value={formData.date} min={todayStr} onChange={handleDateChange} />
            <TimeSlots slots={slots} selectedSlot={formData.selectedSlot ?? ""} onSelect={handleSlotSelect} onBookedClick={handleBookedSlotClick} />
            <Summary serviceLabel={summaryService} masterLabel={summaryMaster} dateLabel={summaryDate} timeLabel={summaryTime} durationLabel={summaryDuration} priceLabel={summaryPrice} />

            <div className="actions">
              <button id="confirmButton" className="btn-primary" type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting ? "Сохраняем…" : isLoading ? "Загрузка…" : "Записаться"}
              </button>
            </div>

            {isLoading ? (
              <p className="hint" style={{ marginTop: 16, textAlign: "center" }}>Загружаем данные…</p>
            ) : history.length > 0 && (
              <section className="history" aria-label="История последних записей">
                <h2 className="history-title">Последние записи</h2>
                <ul className="history-list">
                  {history.map((entry, index) => {
                    const canCancel = !entry.cancelled && !entry.rated;
                    const canRate   = !entry.cancelled && !entry.rated && canRateBooking(entry);
                    return (
                      <li key={entry.id ?? `${entry.date}-${entry.time}-${index}`}
                        className={`history-item${entry.cancelled ? " cancelled" : ""}`}
                      >
                        <div className="history-item-top">
                          <span className="history-item-service">
                            {entry.service}{entry.master ? ` — ${entry.master}` : ""}
                          </span>
                        </div>
                        <div className="history-item-bottom">
                          <span className="history-item-meta">
                            {formatDateForSummary(entry.date)}, {entry.time}
                            {entry.duration ? ` · ${entry.duration} мин` : ""}
                            {entry.price    ? ` · ${entry.price.toLocaleString("ru-RU")} ₽` : ""}
                            {entry.cancelled ? " · Отменена" : ""}
                          </span>
                          {canCancel && (
                            <button type="button" className="cancel-btn"
                              onClick={() => handleCancelBooking(entry.id)} aria-label="Отменить запись">
                              Отменить
                            </button>
                          )}
                        </div>
                        {canRate && (
                          <div className="rate-block">
                            <span className="rate-label">Как прошёл визит к {entry.master}?</span>
                            <div className="rate-stars">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button key={star} type="button" className="rate-star-btn"
                                  onClick={() => handleRateMaster(entry.id, entry.master, star)}
                                  aria-label={`Оценить на ${star}`}>★</button>
                              ))}
                            </div>
                          </div>
                        )}
                        {entry.rated && !entry.cancelled && (
                          <div className="rate-done">Спасибо за оценку ✓</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
