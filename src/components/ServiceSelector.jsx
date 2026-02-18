import PropTypes from "prop-types";

export function ServiceSelector({ value, onChange }) {
  return (
    <div>
      <label htmlFor="serviceSelect" className="section-label">
        Услуга
      </label>
      <select
        id="serviceSelect"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Выберите услугу...</option>
        <optgroup label="Депиляция">
          <option value="laser_depilation">Лазерная депиляция</option>
          <option value="electric_depilation">Электрическая депиляция</option>
          <option value="wax_depilation">Восковая депиляция</option>
        </optgroup>
        <optgroup label="Массаж">
          <option value="neck_massage">Массаж шеи</option>
          <option value="back_massage">Массаж спины</option>
          <option value="full_body_massage">Массаж всего тела</option>
        </optgroup>
      </select>
    </div>
  );
}

ServiceSelector.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

