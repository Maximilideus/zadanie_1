import { useEffect, useMemo, useRef, useState } from "react";
import { ServiceSelector } from "./components/ServiceSelector.jsx";
import { DateSelector } from "./components/DateSelector.jsx";
import { TimeSlots } from "./components/TimeSlots.jsx";
import { Summary } from "./components/Summary.jsx";
import { showSuccessToast, showErrorToast } from "./components/CustomToast.jsx";

const BASE_SLOTS = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const SERVICE_LABELS = {
  laser_depilation: "Лазерная депиляция",
  electric_depilation: "Электрическая депиляция",
  wax_depilation: "Восковая депиляция",
  neck_massage: "Массаж шеи",
  back_massage: "Массаж спины",
  full_body_massage: "Массаж всего тела",
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

function formatDateForSummary(dateStr) {
  if (!dateStr) return "не выбрано";
  const [year, month, day] = dateStr.split("-");
  return `${day}.${month}.${year}`;
}

function getServiceLabel(value) {
  if (!value) return "не выбрано";
  return SERVICE_LABELS[value] ?? "не выбрано";
}

function buildSlotsForDate(dateStr, todayStr, serviceValue, history) {
  if (!dateStr) {
    return BASE_SLOTS.map((time) => ({ time, disabled: false, isBooked: false }));
  }

  const isToday = dateStr === todayStr;
  const now = new Date();
  const currentServiceLabel = getServiceLabel(serviceValue);

  return BASE_SLOTS.map((time) => {
    const isBooked =
      !!serviceValue &&
      history.some(
        (item) =>
          item.service === currentServiceLabel &&
          item.date === dateStr &&
          item.time === time
      );

    let isPast = false;

    if (isToday) {
      const [hours, minutes] = time.split(":").map(Number);
      const slotDate = new Date();
      slotDate.setHours(hours, minutes, 0, 0);
      if (slotDate < now) {
        isPast = true;
      }
    }

    return { time, isPast, isBooked };
  });
}

export function App() {
  const todayStr = useMemo(() => getTodayStr(), []);
  const [formData, setFormData] = useState({
    service: "",
    date: todayStr,
    selectedSlot: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const serviceSelectRef = useRef(null);

  const slots = useMemo(
    () => buildSlotsForDate(formData.date, todayStr, formData.service, history),
    [formData.date, todayStr, formData.service, history]
  );

  const summaryService = getServiceLabel(formData.service);
  const summaryDate = formatDateForSummary(formData.date);
  const summaryTime = formData.selectedSlot || "не выбрано";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.error(
        "Не удалось прочитать историю записей из localStorage:",
        storageError
      );
    }
  }, []);

  const handleConfirm = (event) => {
    if (isSubmitting) return;

    event.preventDefault();

    const problems = [];
    if (!formData.service) problems.push("Выберите услугу.");
    if (!formData.date || !formData.selectedSlot) problems.push("Выберите дату и время.");

    if (problems.length > 0) {
      showErrorToast(problems.join(" "));
      return;
    }

    const newBooking = {
      service: summaryService,
      date: formData.date,
      time: formData.selectedSlot,
    };

    const isDuplicate = history.some(
      (item) =>
        item.service === newBooking.service &&
        item.date === newBooking.date &&
        item.time === newBooking.time
    );

    if (isDuplicate) {
      showErrorToast(
        `Вы уже записаны на ${summaryService} в ${summaryDate} в ${formData.selectedSlot}. Пожалуйста, выберите другое время.`
      );
      return;
    }

    setIsSubmitting(true);
    const updatedHistory = [newBooking, ...history].slice(0, 5);

    try {
      window.localStorage.setItem(SINGLE_BOOKING_KEY, JSON.stringify(newBooking));
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.error("Не удалось сохранить запись в localStorage:", storageError);
    }

    // eslint-disable-next-line no-console
    console.log("Создана запись:", newBooking);

    showSuccessToast(
      `Запись создана: ${summaryService}, ${summaryDate}, ${formData.selectedSlot}. Ждём вас в салоне!`
    );
    setHistory(updatedHistory);

    // Очистка полей после успешной записи
    setFormData({ service: "", date: todayStr, selectedSlot: null });

    // Возврат фокуса на выбор услуги
    if (serviceSelectRef.current) {
      serviceSelectRef.current.focus();
    }

    // Разблокировка кнопки через короткую паузу
    window.setTimeout(() => setIsSubmitting(false), 1500);
  };

  const handleServiceChange = (value) => {
    setFormData((prev) => ({ ...prev, service: value }));
  };

  const handleDateChange = (value) => {
    setFormData((prev) => ({ ...prev, date: value, selectedSlot: null }));
  };

  const handleSlotSelect = (time) => {
    setFormData((prev) => ({ ...prev, selectedSlot: time }));
  };

  const handleBookedSlotClick = () => {
    showErrorToast(
      "К сожалению, это время уже занято другим клиентом. Пожалуйста, выберите другой слот."
    );
  };

  return (
    <div className="root-bg">
      <main className="page">
        <section className="card" aria-label="Форма онлайн-записи в салон красоты">
          <form onSubmit={handleConfirm}>
            <header className="card-header">
              <h1 className="title">Запись на услугу</h1>
              <p className="subtitle">
                Выберите процедуру, дату и удобное время.
              </p>
            </header>

            <ServiceSelector
              value={formData.service}
              onChange={handleServiceChange}
              selectRef={serviceSelectRef}
            />
            <DateSelector
              value={formData.date}
              min={todayStr}
              onChange={handleDateChange}
            />
            <TimeSlots
              slots={slots}
              selectedSlot={formData.selectedSlot ?? ""}
              onSelect={handleSlotSelect}
              onBookedClick={handleBookedSlotClick}
            />

            <Summary
              serviceLabel={summaryService}
              dateLabel={summaryDate}
              timeLabel={summaryTime}
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
              <section
                className="history"
                aria-label="История последних записей"
              >
                <h2 className="history-title">Последние записи</h2>
                <ul className="history-list">
                  {history.map((entry, index) => (
                    <li
                      key={`${entry.date}-${entry.time}-${entry.service}-${index}`}
                      className="history-item"
                    >
                      <span className="history-item-service">
                        {entry.service}
                      </span>
                      <span className="history-item-meta">
                        {formatDateForSummary(entry.date)}, {entry.time}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}

