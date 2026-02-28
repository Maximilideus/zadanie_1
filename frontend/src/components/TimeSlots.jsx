import PropTypes from "prop-types";

export function TimeSlots({ slots, selectedSlot, onSelect, onBookedClick }) {
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
              slot.isPast ? "disabled" : "",
              slot.isBooked ? "booked" : "",
              !slot.isPast && !slot.isBooked && selectedSlot === slot.time
                ? "selected"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={slot.isPast}
            onClick={() => {
              if (slot.isBooked) {
                if (onBookedClick) onBookedClick(slot);
                return;
              }
              onSelect(slot.time);
            }}
          >
            {slot.time}
          </button>
        ))}
      </div>
      <div className="hint">Выберите дату и услугу, чтобы увидеть доступные слоты.</div>
    </div>
  );
}

TimeSlots.propTypes = {
  slots: PropTypes.arrayOf(
    PropTypes.shape({
      time: PropTypes.string.isRequired,
      isPast: PropTypes.bool.isRequired,
      isBooked: PropTypes.bool,
    })
  ).isRequired,
  selectedSlot: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onBookedClick: PropTypes.func,
};
