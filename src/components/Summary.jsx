import PropTypes from "prop-types";

export function Summary({ serviceLabel, dateLabel, timeLabel }) {
  return (
    <div className="summary" aria-live="polite">
      <div className="summary-row">
        <span>Услуга:</span>
        <span>{serviceLabel}</span>
      </div>
      <div className="summary-row">
        <span>Дата:</span>
        <span>{dateLabel}</span>
      </div>
      <div className="summary-row">
        <span>Время:</span>
        <span>{timeLabel}</span>
      </div>
    </div>
  );
}

Summary.propTypes = {
  serviceLabel: PropTypes.string.isRequired,
  dateLabel: PropTypes.string.isRequired,
  timeLabel: PropTypes.string.isRequired,
};

