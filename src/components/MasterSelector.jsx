import PropTypes from "prop-types";
import { MASTERS_DATA } from "../App.jsx";

function StarRating({ rating }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25;
  return (
    <span className="master-rating" aria-label={`Рейтинг ${rating}`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <span key={i} className="star full">★</span>;
        if (i === full && hasHalf) return <span key={i} className="star half">★</span>;
        return <span key={i} className="star empty">★</span>;
      })}
      <span className="rating-number">{rating}</span>
    </span>
  );
}

StarRating.propTypes = {
  rating: PropTypes.number.isRequired,
};

export function MasterSelector({ value, masters, onChange }) {
  if (!masters.length) return null;

  return (
    <div className="master-selector">
      <div className="section-label">Мастер</div>
      <div className="master-cards">
        {masters.map((name) => {
          const data = MASTERS_DATA[name] ?? {};
          const isSelected = value === name;
          return (
            <button
              key={name}
              type="button"
              className={`master-card${isSelected ? " selected" : ""}`}
              onClick={() => onChange(name)}
              aria-pressed={isSelected}
            >
              <div className="master-avatar-wrap">
                {data.photo ? (
                  <img
                    src={data.photo}
                    alt={name}
                    className="master-avatar"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="master-avatar-fallback"
                  style={{ display: data.photo ? "none" : "flex" }}
                >
                  {name[0]}
                </div>
              </div>
              <div className="master-info">
                <span className="master-name">{name}</span>
                {data.specialization && (
                  <span className="master-spec">{data.specialization}</span>
                )}
                {data.rating && <StarRating rating={data.rating} />}
              </div>
              {isSelected && <span className="master-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

MasterSelector.propTypes = {
  value: PropTypes.string.isRequired,
  masters: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};
