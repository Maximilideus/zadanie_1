import { MASTERS_DATA } from "../App.jsx";

// ─── Админ-бар (правый верхний угол) ─────────────────────────────────────
function AdminBar({ isAdmin, session, onAdminClick, onLoginClick, onSignOut }) {
  if (!isAdmin && session) return null; // обычный залогиненный — не показываем

  return (
    <div className="admin-access-bar">
      {isAdmin && (
        <>
          <span className="admin-bar-email">{session.user.email}</span>
          <button className="admin-bar-btn" onClick={onAdminClick}>Админ-панель</button>
          <button className="admin-bar-btn" onClick={onSignOut}>Выйти</button>
        </>
      )}
      {!session && (
        <button className="admin-bar-btn admin-login-btn" onClick={onLoginClick}>🔑</button>
      )}
    </div>
  );
}

// Блок 1 — Hero
function HeroSection({ botUrl }) {
  return (
    <section className="land-hero">
      <div className="land-hero-bg" aria-hidden="true">
        <div className="land-hero-circle land-hero-circle--1" />
        <div className="land-hero-circle land-hero-circle--2" />
      </div>
      <div className="land-hero-content">
        <p className="land-eyebrow">Студия лазерной депиляции</p>
        <h1 className="land-h1">
          Гладкая кожа —<br />
          <span className="land-h1-accent">навсегда</span>
        </h1>
        <p className="land-hero-sub">
          Диодный лазер нового поколения. Безболезненно, безопасно,
          с&nbsp;гарантией результата уже после первого сеанса.
        </p>
        <div className="landing-cta-buttons">
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-btn-telegram">
            📱 Записаться в Telegram
          </a>
          <a href={botUrl + "?start=help"} target="_blank" rel="noopener noreferrer" className="land-btn-telegram-secondary">
            🤔 Помогу выбрать процедуру
          </a>
        </div>
        <p className="land-hero-hint">Без звонков · Выберите мастера и удобное время в боте</p>
      </div>
    </section>
  );
}

// Блок 2 — Почему лазер
function WhySection() {
  const items = [
    { icon: "✦", title: "До 95% навсегда", text: "После 8–10 сеансов рост волос прекращается на годы" },
    { icon: "❄", title: "Без боли",         text: "Встроенное охлаждение — процедура комфортна даже для чувствительной кожи" },
    { icon: "⚡", title: "Быстро",           text: "Подмышки — 5 минут, ноги полностью — около 40 минут" },
    { icon: "◎", title: "Любой тип кожи",   text: "Диодный лазер безопасен для светлой и смуглой кожи" },
  ];
  return (
    <section className="land-section">
      <div className="land-section-inner">
        <p className="land-section-tag">Почему лазер</p>
        <h2 className="land-h2">Забудьте о бритве навсегда</h2>
        <div className="land-why-grid">
          {items.map((item) => (
            <div key={item.title} className="land-why-card">
              <span className="land-why-icon">{item.icon}</span>
              <strong className="land-why-title">{item.title}</strong>
              <p className="land-why-text">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок 3 — Как проходит процедура
function HowSection() {
  const steps = [
    { n: "01", title: "Консультация",   text: "Обсуждаем зоны, тип кожи и волос. Отвечаем на все вопросы." },
    { n: "02", title: "Подготовка",     text: "Наносим охлаждающий гель, настраиваем лазер индивидуально." },
    { n: "03", title: "Процедура",      text: "Мягкие импульсы лазера воздействуют на фолликулы. Ощущение — лёгкое тепло." },
    { n: "04", title: "Уход после",     text: "Рекомендации по уходу. Результат заметен через 2–3 недели." },
  ];
  return (
    <section className="land-section land-section--alt">
      <div className="land-section-inner">
        <p className="land-section-tag">Процедура</p>
        <h2 className="land-h2">Как это происходит</h2>
        <div className="land-steps">
          {steps.map((s) => (
            <div key={s.n} className="land-step">
              <span className="land-step-n">{s.n}</span>
              <div className="land-step-body">
                <strong className="land-step-title">{s.title}</strong>
                <p className="land-step-text">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок 4 — Подготовка
function PrepSection() {
  const dos = [
    "За сутки — побрить зону бритвой или депиляционным кремом",
    "Прийти с чистой кожей без крема и дезодоранта",
    "Сообщить о принимаемых лекарствах",
  ];
  const donts = [
    "За месяц — не делать шугаринг, восковую депиляцию",
    "За 14 дней — не загорать и не посещать солярий",
    "За 3 дня — не использовать скрабы и пилинги",
  ];
  return (
    <section className="land-section">
      <div className="land-section-inner">
        <p className="land-section-tag">Подготовка</p>
        <h2 className="land-h2">Перед процедурой</h2>
        <div className="land-prep-grid">
          <div className="land-prep-col">
            <p className="land-prep-label land-prep-label--do">✓ Нужно</p>
            <ul className="land-prep-list">
              {dos.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div className="land-prep-col">
            <p className="land-prep-label land-prep-label--dont">✕ Нельзя</p>
            <ul className="land-prep-list land-prep-list--dont">
              {donts.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// Блок 5 — Мастера
function MastersSection({ botUrl }) {
  const masters = Object.entries(MASTERS_DATA);
  return (
    <section className="land-section land-section--alt">
      <div className="land-section-inner">
        <p className="land-section-tag">Команда</p>
        <h2 className="land-h2">Наши специалисты</h2>
        <div className="land-masters-grid">
          {masters.map(([name, data]) => (
            <div key={name} className="land-master-card">
              <div className="land-master-avatar-wrap">
                <img
                  src={data.photo}
                  alt={name}
                  className="land-master-avatar"
                  loading="lazy"
                />
              </div>
              <strong className="land-master-name">{name}</strong>
              <p className="land-master-spec">{data.specialization}</p>
              <div className="land-master-rating">
                {"★".repeat(5)}
                <span>{data.rating}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: "32px" }}>
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-btn-telegram">
            📱 Выбрать мастера и записаться
          </a>
        </div>
      </div>
    </section>
  );
}

// Блок 6 — Отзывы
function ReviewsSection() {
  const reviews = [
    { name: "Алина К.",    text: "После первого сеанса волоски стали значительно тоньше. Мастер всё объяснила, было совсем не больно!", stars: 5 },
    { name: "Марина Д.",   text: "Хожу уже третий сеанс — результат виден. Удобная запись через бота, не нужно звонить.", stars: 5 },
    { name: "Светлана П.", text: "Приятная атмосфера, профессиональный подход. Рекомендую всем подругам.", stars: 5 },
  ];
  return (
    <section className="land-section">
      <div className="land-section-inner">
        <p className="land-section-tag">Отзывы</p>
        <h2 className="land-h2">Что говорят клиентки</h2>
        <div className="land-reviews-grid">
          {reviews.map((r) => (
            <div key={r.name} className="land-review-card">
              <p className="land-review-stars">{"★".repeat(r.stars)}</p>
              <p className="land-review-text">«{r.text}»</p>
              <p className="land-review-name">{r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок 7 — CTA
function CtaSection({ botUrl }) {
  return (
    <section className="land-cta">
      <div className="land-cta-inner">
        <h2 className="land-cta-title">Готовы к первому сеансу?</h2>
        <p className="land-cta-sub">Запишитесь через Telegram за 2 минуты — без звонков и ожидания</p>
        <div className="landing-cta-buttons">
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-btn-telegram land-btn-telegram--light">
            📱 Записаться в Telegram
          </a>
        </div>
      </div>
    </section>
  );
}

// Главный компонент лендинга
export function LandingPage({ botUrl, isAdmin, session, onAdminClick, onLoginClick, onSignOut }) {
  return (
    <div className="land-root">
      <AdminBar
        isAdmin={isAdmin}
        session={session}
        onAdminClick={onAdminClick}
        onLoginClick={onLoginClick}
        onSignOut={onSignOut}
      />
      <HeroSection botUrl={botUrl} />
      <WhySection />
      <HowSection />
      <PrepSection />
      <MastersSection botUrl={botUrl} />
      <ReviewsSection />
      <CtaSection botUrl={botUrl} />
    </div>
  );
}
