import PropTypes from "prop-types";

export function DateSelector({ value, min, onChange }) {
  return (
    <div>
      <label htmlFor="dateInput" className="section-label">
        Дата
      </label>
      <input
        type="date"
        id="dateInput"
        value={value}
        min={min}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

DateSelector.propTypes = {
  value: PropTypes.string.isRequired,
  min: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

