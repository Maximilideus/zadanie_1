import PropTypes from "prop-types";
import { SERVICES } from "../App.jsx";

export function ServiceSelector({ value, onChange, selectRef }) {
  const depilation = ["laser_depilation", "electric_depilation", "wax_depilation"];
  const massage = ["neck_massage", "back_massage", "full_body_massage"];

  const renderOption = (key) => {
    const svc = SERVICES[key];
    return (
      <option key={key} value={key}>
        {svc.label} — {svc.price.toLocaleString("ru-RU")} ₽
      </option>
    );
  };

  return (
    <div>
      <label htmlFor="serviceSelect" className="section-label">Услуга</label>
      <select
        id="serviceSelect"
        ref={selectRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Выберите услугу...</option>
        <optgroup label="Депиляция">
          {depilation.map(renderOption)}
        </optgroup>
        <optgroup label="Массаж">
          {massage.map(renderOption)}
        </optgroup>
      </select>
    </div>
  );
}

ServiceSelector.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  selectRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
