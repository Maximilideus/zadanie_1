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

// Услуги с ценой и доступными длительностями
export const SERVICES = {
  laser_depilation:    { label: "Лазерная депиляция",     price: 2500, durations: [30, 60, 90] },
  electric_depilation: { label: "Электрическая депиляция", price: 1800, durations: [30, 60] },
  wax_depilation:      { label: "Восковая депиляция",      price: 1200, durations: [30, 60] },
  neck_massage:        { label: "Массаж шеи",              price: 1500, durations: [30, 60] },
  back_massage:        { label: "Массаж спины",            price: 2000, durations: [60, 90] },
  full_body_massage:   { label: "Массаж всего тела",       price: 3500, durations: [60, 90] },
};

// Базовые данные мастеров — рейтинг здесь это «дефолт», если пользователь ещё не оставил оценок
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

const SINGLE_BOOKING_KEY  = "booking";
const HISTORY_STORAGE_KEY = "bookingHistory";
// Оценки хранятся отдельно: { "Анна": [5, 4, 5], "Мария": [3, 5] }
const RATINGS_STORAGE_KEY = "masterRatings";

// Через сколько часов после записи появляется кнопка «Оценить»
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

// Проверяем, прошло ли достаточно времени с момента создания записи
function canRateBooking(booking) {
  if (!booking.createdAt) return true; // старые записи без метки — разрешаем
  const created = new Date(booking.createdAt);
  // Защита: битый createdAt даёт Invalid Date → isNaN → разрешаем оценку
  if (isNaN(created.getTime())) return true;
  const diffHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return diffHours >= HOURS_UNTIL_RATE;
}

function timeToMinutes(time) {
  // Защита: если time пустой или не "HH:MM" — возвращаем -1 (не крешит, не блокирует слот)
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

  // Бронирования этого мастера на эту дату (не отменённые)
  const masterBookings = masterValue
    ? history.filter(
        (item) => !item.cancelled && item.master === masterValue && item.date === dateStr
      )
    : [];

  return BASE_SLOTS.map((time) => {
    const slotStart = timeToMinutes(time);

    // Слот занят, если попадает внутрь любой существующей записи с учётом длительности
    const isBooked = masterBookings.some((item) => {
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

// Считаем средний рейтинг мастера из сохранённых оценок.
// Если оценок нет — возвращаем дефолтный рейтинг из MASTERS_DATA.
export function calcRating(masterName, ratingsMap) {
  const scores = ratingsMap[masterName];
  // Защита: scores должен быть непустым массивом чисел
  if (!Array.isArray(scores) || scores.length === 0) {
    return MASTERS_DATA[masterName]?.rating ?? null;
  }
  // Фильтруем мусор: оставляем только числа от 1 до 5
  const valid = scores.filter((s) => typeof s === "number" && s >= 1 && s <= 5);
  if (valid.length === 0) return MASTERS_DATA[masterName]?.rating ?? null;
  const avg = valid.reduce((sum, s) => sum + s, 0) / valid.length;
  return Math.round(avg * 10) / 10; // округляем до 1 знака
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
  const [history,      setHistory]      = useState([]);

  // ratingsMap: { "Анна": [5, 4], "Мария": [3] }
  const [ratingsMap, setRatingsMap] = useState({});

  const serviceSelectRef = useRef(null);

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

  // Загружаем историю и оценки из localStorage при старте
  useEffect(() => {
    // История — отдельный try/catch, чтобы сбой рейтингов не убил историю и наоборот
    try {
      const storedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            // Защита: фильтруем записи без обязательных полей (битые данные)
            .filter((item) => item && typeof item === "object" && item.service && item.date && item.time)
            // Гарантируем уникальный id у каждой записи
            .map((item, i) =>
              item.id ? item : { ...item, id: `legacy-${i}-${item.date}-${item.time}` }
            );
          setHistory(normalized);
        }
      }
    } catch (e) {
      // Повреждённый JSON — показываем пустую историю, не крешим
      console.error("История повреждена, сбрасываем:", e);
      setHistory([]);
    }

    try {
      const storedRatings = window.localStorage.getItem(RATINGS_STORAGE_KEY);
      if (storedRatings) {
        const parsed = JSON.parse(storedRatings);
        // Защита: должен быть объект, не массив и не null
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setRatingsMap(parsed);
        }
      }
    } catch (e) {
      console.error("Оценки повреждены, сбрасываем:", e);
      setRatingsMap({});
    }
  }, []);

  // Сохраняем запись
  const handleConfirm = (event) => {
    if (isSubmitting) return;
    event.preventDefault();

    const problems = [];
    if (!formData.service)                         problems.push("Выберите услугу.");
    if (!formData.master)                          problems.push("Выберите мастера.");
    if (!formData.duration)                        problems.push("Выберите длительность.");
    if (!formData.date || !formData.selectedSlot)  problems.push("Выберите дату и время.");

    if (problems.length > 0) {
      showErrorToast(problems.join(" "));
      return;
    }

    const newBooking = {
      id:        Date.now().toString(),
      createdAt: new Date().toISOString(), // нужно для логики «Оценить»
      service:   summaryService,
      master:    formData.master,
      date:      formData.date,
      time:      formData.selectedSlot,
      duration:  formData.duration,
      price:     servicePrice,
      cancelled: false,
      rated:     false, // станет true после того как пользователь поставил оценку
    };

    const isDuplicate = history.some(
      (item) =>
        !item.cancelled &&
        item.service === newBooking.service &&
        item.master  === newBooking.master  &&
        item.date    === newBooking.date    &&
        item.time    === newBooking.time
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
      window.localStorage.setItem(SINGLE_BOOKING_KEY,  JSON.stringify(newBooking));
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Не удалось сохранить запись:", e);
    }

    showSuccessToast(`Запись создана: ${summaryService}, ${formData.master}, ${summaryDate}, ${formData.selectedSlot}.`);
    setHistory(updatedHistory);
    setFormData({ service: "", master: "", date: todayStr, selectedSlot: null, duration: null });

    if (serviceSelectRef.current) serviceSelectRef.current.focus();
    window.setTimeout(() => setIsSubmitting(false), 1500);
  };

  // Отмена записи — помечаем как cancelled, освобождает слот
  const handleCancelBooking = (bookingId) => {
    const updatedHistory = history.map((item) =>
      item.id === bookingId ? { ...item, cancelled: true } : item
    );
    saveHistory(updatedHistory);
    showSuccessToast("Запись отменена.");
  };

  // Оценка мастера: сохраняем score, помечаем запись как rated
  const handleRateMaster = (bookingId, masterName, score) => {
    // Обновляем оценки мастера
    const currentScores = ratingsMap[masterName] ?? [];
    const updatedRatings = { ...ratingsMap, [masterName]: [...currentScores, score] };
    setRatingsMap(updatedRatings);
    try {
      window.localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(updatedRatings));
    } catch (e) {
      console.error("Не удалось сохранить оценку:", e);
    }

    // Помечаем запись как «уже оценена», чтобы скрыть кнопку
    const updatedHistory = history.map((item) =>
      item.id === bookingId ? { ...item, rated: true } : item
    );
    saveHistory(updatedHistory);

    showSuccessToast(`Спасибо за оценку! ${masterName} получает ваши ★`);
  };

  // Вспомогательная функция: обновить state + localStorage
  const saveHistory = (updatedHistory) => {
    setHistory(updatedHistory);
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (e) {
      // QuotaExceededError — хранилище переполнено
      if (e.name === "QuotaExceededError") {
        showErrorToast("Не удалось сохранить: хранилище браузера переполнено.");
      } else {
        console.error("Не удалось обновить историю:", e);
      }
    }
  };

  const handleServiceChange  = (value) => setFormData((prev) => ({ ...prev, service: value, master: "", duration: null }));
  const handleMasterChange   = (value) => setFormData((prev) => ({ ...prev, master: value }));
  const handleDateChange     = (value) => {
    // Защита: не принимаем дату в прошлом (пользователь мог вписать вручную)
    if (value < todayStr) {
      showErrorToast("Нельзя записаться на прошедшую дату.");
      return;
    }
    setFormData((prev) => ({ ...prev, date: value, selectedSlot: null }));
  };
  const handleSlotSelect     = (time)  => setFormData((prev) => ({ ...prev, selectedSlot: time }));
  const handleDurationChange = (dur)   => setFormData((prev) => ({ ...prev, duration: dur }));
  const handleBookedSlotClick = ()     => showErrorToast("Это время уже занято. Пожалуйста, выберите другой слот.");

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

            {/* Длительность появляется только после выбора услуги */}
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

            {/* Передаём актуальные рейтинги в карточки мастеров */}
            <MasterSelector
              value={formData.master}
              masters={availableMasters}
              onChange={handleMasterChange}
              ratingsMap={ratingsMap}
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

            {/* История записей */}
            {history.length > 0 && (
              <section className="history" aria-label="История последних записей">
                <h2 className="history-title">Последние записи</h2>
                <ul className="history-list">
                  {history.map((entry, index) => {
                    const canCancel = !entry.cancelled && !entry.rated;
                    // Кнопка «Оценить» — если не отменена, не оценена, и прошло 24 ч
                    const canRate   = !entry.cancelled && !entry.rated && canRateBooking(entry);

                    return (
                      <li
                        key={entry.id ?? `${entry.date}-${entry.time}-${index}`}
                        className={`history-item${entry.cancelled ? " cancelled" : ""}`}
                      >
                        {/* Верхняя строка: услуга и мастер */}
                        <div className="history-item-top">
                          <span className="history-item-service">
                            {entry.service}{entry.master ? ` — ${entry.master}` : ""}
                          </span>
                        </div>

                        {/* Нижняя строка: дата/время и кнопка отмены */}
                        <div className="history-item-bottom">
                          <span className="history-item-meta">
                            {formatDateForSummary(entry.date)}, {entry.time}
                            {entry.duration ? ` · ${entry.duration} мин` : ""}
                            {entry.price    ? ` · ${entry.price.toLocaleString("ru-RU")} ₽` : ""}
                            {entry.cancelled ? " · Отменена" : ""}
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

                        {/* Блок оценки — появляется через 24 ч после записи */}
                        {canRate && (
                          <div className="rate-block">
                            <span className="rate-label">Как прошёл визит к {entry.master}?</span>
                            <div className="rate-stars">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  className="rate-star-btn"
                                  onClick={() => handleRateMaster(entry.id, entry.master, star)}
                                  aria-label={`Оценить на ${star}`}
                                >
                                  ★
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Если уже оценена — показываем благодарность */}
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
