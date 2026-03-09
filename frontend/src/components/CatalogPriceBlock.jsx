import { useState } from "react";
import { buildTelegramLink } from "../api/telegram.js";
import { getCatalogItemPriceAndDuration } from "../utils/catalogDisplay.js";

const GENDER_LABELS = {
  female: "Женщины",
  male: "Мужчины",
  unisex: "Универсально",
};

/**
 * Renders grouped catalog sections: gender tabs -> group title -> items table.
 * @param {{ data: { category: string, sections: object } | null, loading: boolean, error: string | null }} props
 */
export function CatalogPriceBlock({ data, loading, error }) {
  const [activeGender, setActiveGender] = useState("female");

  if (loading) {
    return (
      <div className="lp-price-table-wrapper">
        <p className="lp-catalog-loading">Загрузка прайса…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lp-price-table-wrapper">
        <p className="lp-catalog-error">Не удалось загрузить прайс. {error}</p>
      </div>
    );
  }

  if (!data?.sections || typeof data.sections !== "object") {
    return (
      <div className="lp-price-table-wrapper">
        <p className="lp-catalog-error">Нет данных прайса.</p>
      </div>
    );
  }

  const sections = data.sections;
  const genderKeys = Object.keys(sections).filter(
    (k) => sections[k] && typeof sections[k] === "object" && Object.keys(sections[k]).length > 0
  );
  const firstGender = genderKeys[0];
  const currentGender = genderKeys.includes(activeGender) ? activeGender : firstGender;
  const groups = currentGender ? sections[currentGender] : {};

  return (
    <>
      {genderKeys.length > 1 && (
        <div className="lp-price-tabs">
          {genderKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={`lp-price-tab${currentGender === key ? " lp-price-tab--active" : ""}`}
              onClick={() => setActiveGender(key)}
            >
              {GENDER_LABELS[key] ?? key}
            </button>
          ))}
        </div>
      )}

      {Object.entries(groups).map(([groupKey, group]) => {
        if (!group?.items?.length) return null;
        return (
          <div key={groupKey} className="lp-catalog-group">
            <h3 className="lp-catalog-group-title">{group.title}</h3>
            <div className="lp-price-table">
              <div className="lp-price-header">
                <span>Зона / Услуга</span>
                <span>Время</span>
                <span>Цена</span>
              </div>
              {group.items.map((item) => {
                const { price, durationMin } = getCatalogItemPriceAndDuration(item);
                const timeLabel = item.subtitle ?? (durationMin != null ? `${durationMin} мин` : "—");
                const priceLabel = price != null ? `${price} ₽` : "—";
                const rowContent = (
                  <>
                    <span className="lp-price-zone">
                      {item.title}
                      {item.description && (
                        <span className="lp-price-desc">{item.description}</span>
                      )}
                    </span>
                    <span className="lp-price-time">{timeLabel}</span>
                    <span className="lp-price-val">{priceLabel}</span>
                  </>
                );

                return item.id ? (
                  <a
                    key={item.id}
                    href={buildTelegramLink(item.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lp-price-row lp-price-row--bookable"
                  >
                    {rowContent}
                  </a>
                ) : (
                  <div className="lp-price-row" key={item.title}>
                    {rowContent}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
