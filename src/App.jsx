import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceSelector } from "./components/ServiceSelector.jsx";
import { MasterSelector } from "./components/MasterSelector.jsx";
import { DateSelector } from "./components/DateSelector.jsx";
import { TimeSlots } from "./components/TimeSlots.jsx";
import { Summary } from "./components/Summary.jsx";
import { showSuccessToast, showErrorToast } from "./components/CustomToast.jsx";

const BASE_SLOTS = [
  "10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00",
];

// Услуги с ценой и длительностью
export const SERVICES = {
  laser_depilation:    { label: "Лазерная депиляция",    price: 2500, durations: [30, 60, 90] },
  electric_depilation: { label: "Электрическая депиляция", price: 1800, durations: [30, 60] },
  wax_depilation:      { label: "Восковая депиляция",     price: 1200, durations: [30, 60] },
  neck_massage:        { label: "Массаж шеи",             price: 1500, durations: [30, 60] },
  back_massage:        { label: "Массаж спины",           price: 2000, durations: [60, 90] },
  full_body_massage:   { label: "Массаж всего тела",      price: 3500, durations: [60, 90] },
};

// Мастера с фото (аватары через UI Avatars) и рейтингом
export const MASTERS_DATA = {
  "Анна":    { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Anna",    rating: 4.9, specialization: "Депиляция" },
  "Мария":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Maria",   rating: 4.7, specialization: "Депиляция" },
  "Елена":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Elena",   rating: 4.8, specialization: "Массаж и депиляция" },
  "Дмитрий": { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Dmitry",  rating: 4.6, specialization: "Массаж" },
};

export const MASTERS_BY_SERVICE = {
  laser_depilation:    ["Анна", "Мария"],
  electric_depilation: ["Мария"],
  wax_depilation:      ["Анна", "Елена"],
  neck_massage:        ["Елена", "Дмитрий"],
  back_massage:        ["Дмитрий"],
  full_body_massage:   ["Елена", "Дмитрий"],
};

// Статусы записей
export const BOOKING_STATUS = {
  pending:   { label: "Ожидает",      className: "status-pending" },
  confirmed: { label: "Подтверждена", className: "status-confirmed" },
  completed: { label: "Завершена",    className: "status-completed" },
  cancelled: { label: "Отменена",     className: "status-cancelled" },
};

const SINGLE_BOOKING_KEY = "booking";
const HISTORY_STORAGE_KEY = "bookingHistory";

function getTodayStr() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
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

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
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
        (item) =>
          item.status !== "cancelled" &&
          item.master === masterValue &&
          item.date === dateStr
      )
    : [];

  return BASE_SLOTS.map((time) => {
    const slotStart = timeToMinutes(time);

    const isBooked = masterBookings.some((item) => {
      const itemStart = timeToMinutes(item.time);
      const itemEnd = itemStart + (item.duration ?? 60);
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

export function App() {
  const todayStr = useMemo(() => getTodayStr(), []);
  const [formData, setFormData] = useState({
    service: "",
    master: "",
    date: todayStr,
    selectedSlot: null,
    duration: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const serviceSelectRef = useRef(null);

  const availableMasters = useMemo(
    () => MASTERS_BY_SERVICE[formData.service] ?? [],
    [formData.service]
  );

  const availableDurations = useMemo(
    () => SERVICES[formData.service]?.durations ?? [],
    [formData.service]
  );

  const servicePrice = useMemo(
    () => SERVICES[formData.service]?.price ?? null,
    [formData.service]
  );

  const slots = useMemo(
    () => buildSlotsForDate(formData.date, todayStr, formData.master, history),
    [formData.date, todayStr, formData.master, history]
  );

  const summaryService = getServiceLabel(formData.service);
  const summaryMaster = formData.master || "не выбрано";
  const summaryDate = formatDateForSummary(formData.date);
  const summaryTime = formData.selectedSlot || "не выбрано";
  const summaryDuration = formData.duration ? `${formData.duration} мин` : "не выбрано";
  const summaryPrice = servicePrice
    ? `${servicePrice.toLocaleString("ru-RU")} ₽`
    : "не выбрано";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Гарантируем, что у каждой записи есть уникальный id
          const normalized = parsed.map((item, i) =>
            item.id ? item : { ...item, id: `legacy-${i}-${item.date}-${item.time}` }
          );
          setHistory(normalized);
        }
      }
    } catch (storageError) {
      console.error("Не удалось прочитать историю:", storageError);
    }
  }, []);

  const handleConfirm = (event) => {
    if (isSubmitting) return;
    event.preventDefault();

    const problems = [];
    if (!formData.service) problems.push("Выберите услугу.");
    if (!formData.master) problems.push("Выберите мастера.");
    if (!formData.duration) problems.push("Выберите длительность.");
    if (!formData.date || !formData.selectedSlot) problems.push("Выберите дату и время.");

    if (problems.length > 0) {
      showErrorToast(problems.join(" "));
      return;
    }

    const newBooking = {
      id: Date.now().toString(),
      service: summaryService,
      master: formData.master,
      date: formData.date,
      time: formData.selectedSlot,
      duration: formData.duration,
      price: servicePrice,
      status: "pending",
    };

    const isDuplicate = history.some(
      (item) =>
        item.status !== "cancelled" &&
        item.service === newBooking.service &&
        item.master === newBooking.master &&
        item.date === newBooking.date &&
        item.time === newBooking.time
    );

    if (isDuplicate) {
      showErrorToast(
        `Вы уже записаны на ${summaryService} к ${formData.master} на ${summaryDate} в ${formData.selectedSlot}.`
      );
      return;
    }

    setIsSubmitting(true);
    const updatedHistory = [newBooking, ...history].slice(0, 5);

    try {
      window.localStorage.setItem(SINGLE_BOOKING_KEY, JSON.stringify(newBooking));
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (storageError) {
      console.error("Не удалось сохранить запись:", storageError);
    }

    showSuccessToast(
      `Запись создана: ${summaryService}, ${formData.master}, ${summaryDate}, ${formData.selectedSlot}.`
    );
    setHistory(updatedHistory);
    setFormData({ service: "", master: "", date: todayStr, selectedSlot: null, duration: null });

    if (serviceSelectRef.current) serviceSelectRef.current.focus();
    window.setTimeout(() => setIsSubmitting(false), 1500);
  };

  // Отмена записи из истории
  const handleCancelBooking = (bookingId) => {
    const updatedHistory = history.map((item) =>
      item.id === bookingId ? { ...item, status: "cancelled" } : item
    );
    setHistory(updatedHistory);
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Не удалось обновить историю:", e);
    }
    showSuccessToast("Запись отменена.");
  };

  const handleServiceChange = (value) => {
    setFormData((prev) => ({ ...prev, service: value, master: "", duration: null }));
  };
  const handleMasterChange = (value) => {
    setFormData((prev) => ({ ...prev, master: value }));
  };
  const handleDateChange = (value) => {
    setFormData((prev) => ({ ...prev, date: value, selectedSlot: null }));
  };
  const handleSlotSelect = (time) => {
    setFormData((prev) => ({ ...prev, selectedSlot: time }));
  };
  const handleDurationChange = (duration) => {
    setFormData((prev) => ({ ...prev, duration }));
  };
  const handleBookedSlotClick = () => {
    showErrorToast("Это время уже занято. Пожалуйста, выберите другой слот.");
  };

  return (
    <div className="root-bg">
      <main className="page">
        <section className="card" aria-label="Форма онлайн-записи в салон красоты">
          <form onSubmit={handleConfirm}>
            <header className="card-header">
              <h1 className="title">Запись на услугу</h1>
              <p className="subtitle">Выберите процедуру, дату и удобное время.</p>
            </header>

            <ServiceSelector
              value={formData.service}
              onChange={handleServiceChange}
              selectRef={serviceSelectRef}
            />

            {formData.service && availableDurations.length > 0 && (
              <div className="duration-selector">
                <div className="section-label">Длительность</div>
                <div className="duration-options">
                  {availableDurations.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`duration-btn${formData.duration === d ? " selected" : ""}`}
                      onClick={() => handleDurationChange(d)}
                    >
                      {d} мин
                    </button>
                  ))}
                </div>
              </div>
            )}

            <MasterSelector
              value={formData.master}
              masters={availableMasters}
              onChange={handleMasterChange}
            />
            <DateSelector value={formData.date} min={todayStr} onChange={handleDateChange} />
            <TimeSlots
              slots={slots}
              selectedSlot={formData.selectedSlot ?? ""}
              onSelect={handleSlotSelect}
              onBookedClick={handleBookedSlotClick}
            />
            <Summary
              serviceLabel={summaryService}
              masterLabel={summaryMaster}
              dateLabel={summaryDate}
              timeLabel={summaryTime}
              durationLabel={summaryDuration}
              priceLabel={summaryPrice}
            />

            <div className="actions">
              <button
                id="confirmButton"
                className="btn-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Сохраняем…" : "Записаться"}
              </button>
            </div>

            {history.length > 0 && (
              <section className="history" aria-label="История последних записей">
                <h2 className="history-title">Последние записи</h2>
                <ul className="history-list">
                  {history.map((entry, index) => {
                    const statusInfo = BOOKING_STATUS[entry.status] ?? BOOKING_STATUS.pending;
                    const canCancel = entry.status !== "cancelled" && entry.status !== "completed";
                    return (
                      <li
                        key={entry.id ?? `${entry.date}-${entry.time}-${index}`}
                        className={`history-item${entry.status === "cancelled" ? " cancelled" : ""}`}
                      >
                        <div className="history-item-top">
                          <span className="history-item-service">
                            {entry.service}{entry.master ? ` — ${entry.master}` : ""}
                          </span>
                          <span className={`status-badge ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="history-item-bottom">
                          <span className="history-item-meta">
                            {formatDateForSummary(entry.date)}, {entry.time}
                            {entry.duration ? ` · ${entry.duration} мин` : ""}
                            {entry.price ? ` · ${entry.price.toLocaleString("ru-RU")} ₽` : ""}
                          </span>
                          {canCancel && (
                            <button
                              type="button"
                              className="cancel-btn"
                              onClick={() => handleCancelBooking(entry.id)}
                              aria-label="Отменить запись"
                            >
                              Отменить
                            </button>
                          )}
                        </div>
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
