import { useState } from "react";
import { buildTelegramLink } from "../api/telegram.js";
import { getCatalogItemPriceAndDuration } from "../utils/catalogDisplay.js";

const GENDER_LABELS = {
  female: "Женщины",
  male: "Мужчины",
  unisex: "Универсально",
};

const GROUP_TITLES = {
  face: "Лицо",
  body: "Тело",
  intimate: "Интимная зона",
  other: "Другое",
};

/**
 * Renders grouped catalog: services (face/body/intimate/other), packages, subscriptions.
 * @param {{ data: { category: string, services: object, packages: object, subscriptions: object } | null, loading: boolean, error: string | null }} props
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

  const services = data?.services ?? {};
  const packages = data?.packages ?? {};
  const subscriptions = data?.subscriptions ?? {};

  const hasAnyData = (obj) =>
    obj && typeof obj === "object" && Object.keys(obj).length > 0;
  const genderKeys = ["female", "male", "unisex"].filter((k) => {
    const hasServices = hasAnyData(services[k]);
    const hasPackages = Array.isArray(packages[k]) && packages[k].length > 0;
    const hasSubs = Array.isArray(subscriptions[k]) && subscriptions[k].length > 0;
    return hasServices || hasPackages || hasSubs;
  });

  const firstGender = genderKeys[0];
  const currentGender = genderKeys.includes(activeGender) ? activeGender : firstGender;

  const serviceGroups = currentGender ? services[currentGender] ?? {} : {};
  const packageList = currentGender ? packages[currentGender] ?? [] : [];
  const subscriptionList = currentGender ? subscriptions[currentGender] ?? [] : [];

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

      {/* Services: Лицо, Тело, Интимная зона, Другое */}
      {Object.entries(serviceGroups).map(([groupKey, group]) => {
        if (!group?.items?.length) return null;
        const title = group.title ?? GROUP_TITLES[groupKey] ?? groupKey;
        return (
          <div key={groupKey} className="lp-catalog-group">
            <h3 className="lp-catalog-group-title">{title}</h3>
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

      {/* Packages: Комплексы */}
      {packageList.length > 0 && (
        <div className="lp-catalog-group">
          <h3 className="lp-catalog-group-title">Комплексы</h3>
          <div className="lp-price-table lp-price-table--packages">
            <div className="lp-price-header">
              <span>Название</span>
              <span>Состав</span>
              <span>Время</span>
              <span>Цена</span>
            </div>
            {packageList.map((pkg) => {
              const timeLabel = pkg.durationMin != null ? `${pkg.durationMin} мин` : "—";
              const priceLabel = pkg.price != null ? `${pkg.price} ₽` : "—";
              return (
                <a
                  key={pkg.id}
                  href={buildTelegramLink(pkg.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-price-row lp-price-row--bookable"
                >
                  <span className="lp-price-zone">{pkg.name}</span>
                  <span className="lp-price-zone">{pkg.compositionLabel || "—"}</span>
                  <span className="lp-price-time">{timeLabel}</span>
                  <span className="lp-price-val">{priceLabel}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Subscriptions: Абонементы */}
      {subscriptionList.length > 0 && (
        <div className="lp-catalog-group">
          <h3 className="lp-catalog-group-title">Абонементы</h3>
          <div className="lp-price-table lp-price-table--subscriptions">
            <div className="lp-price-header">
              <span>Название</span>
              <span>Детали</span>
              <span>Цена</span>
            </div>
            {subscriptionList.map((sub) => {
              const sessionLabel =
                sub.singleSessionDurationMin != null
                  ? `1 сеанс: ${sub.singleSessionDurationMin} мин`
                  : null;
              const totalLabel =
                sub.totalDurationMin != null ? `Всего: ${sub.totalDurationMin} мин` : null;
              const details = [
                sub.baseName,
                sub.baseCompositionLabel,
                `${sub.quantity} сеансов`,
                sub.discountPercent > 0 ? `Скидка ${sub.discountPercent}%` : null,
                sessionLabel,
                totalLabel,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={sub.id} className="lp-price-row">
                  <span className="lp-price-zone">{sub.name}</span>
                  <span className="lp-price-zone">{details || "—"}</span>
                  <span className="lp-price-val">{sub.finalPrice} ₽</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {genderKeys.length === 0 && (
        <p className="lp-catalog-error">Нет данных прайса.</p>
      )}
    </>
  );
}
