import { useMemo, useRef, useState } from "react";
import { ServiceSelector } from "./components/ServiceSelector.jsx";
import { DateSelector } from "./components/DateSelector.jsx";
import { TimeSlots } from "./components/TimeSlots.jsx";
import { Summary } from "./components/Summary.jsx";

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

function buildSlotsForDate(dateStr, todayStr) {
  if (!dateStr) {
    return BASE_SLOTS.map((time) => ({ time, disabled: false }));
  }

  const isToday = dateStr === todayStr;
  const now = new Date();

  return BASE_SLOTS.map((time) => {
    if (!isToday) {
      return { time, disabled: false };
    }

    const [hours, minutes] = time.split(":").map(Number);
    const slotDate = new Date();
    slotDate.setHours(hours, minutes, 0, 0);

    return {
      time,
      disabled: slotDate <= now,
    };
  });
}

export function App() {
  const todayStr = useMemo(() => getTodayStr(), []);
  const [service, setService] = useState("");
  const [date, setDate] = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serviceSelectRef = useRef(null);

  const slots = useMemo(
    () => buildSlotsForDate(date, todayStr),
    [date, todayStr]
  );

  const summaryService = getServiceLabel(service);
  const summaryDate = formatDateForSummary(date);
  const summaryTime = selectedSlot || "не выбрано";

  const handleConfirm = (event) => {
    if (isSubmitting) {
      return;
    }

    event.preventDefault();
    setError("");
    setSuccess("");

    const problems = [];
    if (!service) {
      problems.push("Выберите услугу.");
    }
    if (!date || !selectedSlot) {
      problems.push("Выберите дату и время.");
    }

    if (problems.length > 0) {
      setError(problems.join(" "));
      return;
    }

    setIsSubmitting(true);

    const booking = {
      service: summaryService,
      date,
      time: selectedSlot,
    };

    try {
      window.localStorage.setItem("booking", JSON.stringify(booking));
    } catch (storageError) {
      // Локальное логирование, чтобы не ломать UX
      console.error("Не удалось сохранить запись в localStorage:", storageError);
    }

    // Для проверки данных записи
    // eslint-disable-next-line no-console
    console.log("Создана запись:", booking);

    const message = `Запись создана: ${summaryService}, ${summaryDate}, ${selectedSlot}. Ждём вас в салоне!`;
    setSuccess(message);

    // Очистка полей после успешной записи
    setService("");
    setDate(todayStr);
    setSelectedSlot(null);

    // Возврат фокуса на выбор услуги
    if (serviceSelectRef.current) {
      serviceSelectRef.current.focus();
    }

    // Разблокировка кнопки через короткую паузу
    window.setTimeout(() => {
      setIsSubmitting(false);
    }, 1500);
  };

  const handleServiceChange = (value) => {
    setService(value);
    setError("");
    setSuccess("");
  };

  const handleDateChange = (value) => {
    setDate(value);
    setSelectedSlot(null);
    setError("");
    setSuccess("");
  };

  const handleSlotSelect = (time) => {
    setSelectedSlot(time);
    setError("");
    setSuccess("");
  };

  return (
    <div className="root-bg">
      <main className="page">
        <section className="card" aria-label="Форма онлайн-записи в салон красоты">
          <header className="card-header">
            <h1 className="title">Запись на услугу</h1>
            <p className="subtitle">
              Выберите процедуру, дату и удобное время.
            </p>
          </header>

          <ServiceSelector
            value={service}
            onChange={handleServiceChange}
            selectRef={serviceSelectRef}
          />
          <DateSelector value={date} min={todayStr} onChange={handleDateChange} />
          <TimeSlots
            slots={slots}
            selectedSlot={selectedSlot ?? ""}
            onSelect={handleSlotSelect}
          />

          <Summary
            serviceLabel={summaryService}
            dateLabel={summaryDate}
            timeLabel={summaryTime}
          />

          <div
            id="errorMessage"
            className="error"
            aria-live="assertive"
          >
            {error}
          </div>
          {success && (
            <div
              id="successMessage"
              className="success"
              aria-live="polite"
            >
              {success}
            </div>
          )}

          <div className="actions">
            <button
              id="confirmButton"
              className="btn-primary"
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              Записаться
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

