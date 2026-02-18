import PropTypes from "prop-types";

export function TimeSlots({ slots, selectedSlot, onSelect }) {
  return (
    <div>
      <div className="section-label">Доступное время</div>
      <div
        id="timeSlots"
        className="time-slots"
        aria-label="Доступные временные слоты"
      >
        {slots.map((slot) => (
          <button
            key={slot.time}
            type="button"
            className={[
              "slot-btn",
              slot.disabled ? "disabled" : "",
              !slot.disabled && selectedSlot === slot.time ? "selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={slot.disabled}
            onClick={() => {
              if (slot.disabled) return;
              onSelect(slot.time);
            }}
          >
            {slot.time}
          </button>
        ))}
      </div>
      <div className="hint">Выберите дату, чтобы увидеть доступные слоты.</div>
    </div>
  );
}

TimeSlots.propTypes = {
  slots: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.string.isRequired,
      disabled: PropTypes.bool.isRequired,
    })
  ).isRequired,
  selectedSlot: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

