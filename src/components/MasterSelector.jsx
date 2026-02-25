import PropTypes from "prop-types";

export function MasterSelector({ value, masters, onChange }) {
  if (!masters.length) return null;

  return (
    <div>
      <label htmlFor="masterSelect" className="section-label">
        Мастер
      </label>
      <select
        id="masterSelect"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Выберите мастера...</option>
        {masters.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

MasterSelector.propTypes = {
  value: PropTypes.string.isRequired,
  masters: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};
