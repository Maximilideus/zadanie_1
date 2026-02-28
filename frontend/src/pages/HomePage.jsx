import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MASTERS_DATA } from "../App.jsx";
import { StickyBookButton } from "../components/StickyBookButton.jsx";
import { useScrollAnimation } from "../components/useScrollAnimation.js";

// ═══════════════════════════════════════════════════════════════
// ADMIN BAR
// ═══════════════════════════════════════════════════════════════

function AdminBar({ isAdmin, session, onAdminClick, onLoginClick, onSignOut }) {
  if (!isAdmin && session) return null;
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

// ═══════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════

function HeroSection({ botUrl }) {
  return (
    <section className="land-hero">
      <div className="land-hero-bg" aria-hidden="true">
        <div className="land-hero-circle land-hero-circle--1" />
        <div className="land-hero-circle land-hero-circle--2" />
      </div>
      <div className="land-hero-content">
        <p className="land-eyebrow">Студия депиляции и массажа · Москва</p>
        <h1 className="land-h1">
          Гладкость —<br />
          <span className="land-h1-accent">это просто.</span>
        </h1>
        <p className="land-hero-sub">
          Профессиональная депиляция и массаж для женщин и мужчин.
          Аккуратно. Понятно. По честной цене.
        </p>
        <div className="landing-cta-buttons">
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-btn-telegram">
            Записаться в Telegram
          </a>
        </div>
        <p className="land-hero-hint">Ответим быстро · Поможем выбрать процедуру</p>
      </div>

      {/* Статистика-бар под Hero */}
      <div className="land-hero-stats">
        <div className="land-hero-stats-inner">
          <div className="land-hero-stat">
            <strong>5+ лет</strong>
            <span>на рынке</span>
          </div>
          <div className="land-hero-stat-divider" />
          <div className="land-hero-stat">
            <strong>1200+</strong>
            <span>клиентов</span>
          </div>
          <div className="land-hero-stat-divider" />
          <div className="land-hero-stat">
            <strong>3 метода</strong>
            <span>депиляции</span>
          </div>
          <div className="land-hero-stat-divider" />
          <div className="land-hero-stat">
            <strong>Для всех</strong>
            <span>женщины и мужчины</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ПОЧЕМУ К НАМ ВОЗВРАЩАЮТСЯ
// ═══════════════════════════════════════════════════════════════

function WhyUsSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.15 });

  const cards = [
    {
      icon: "💰",
      title: "Честные цены",
      text: "Прайс на сайте — финальная цена. Никаких «от» и скрытых доплат на месте.",
    },
    {
      icon: "🖥️",
      title: "Профессиональное оборудование",
      text: "Alma Soprano ICE, Apilus xCell Pro, ItalWax Premium — международные сертификаты FDA и CE.",
    },
    {
      icon: "🤝",
      title: "Комфортно для всех",
      text: "Нейтральная обстановка, без стереотипов. Принимаем женщин и мужчин.",
    },
    {
      icon: "⚙️",
      title: "Настройка под клиента",
      text: "Параметры подбираем индивидуально. Ощущения у всех разные — учитываем это.",
    },
    {
      icon: "💬",
      title: "Прозрачный процесс",
      text: "Мастер объясняет каждый шаг. Вы понимаете, что происходит и чего ожидать.",
    },
    {
      icon: "📱",
      title: "Удобная запись",
      text: "Telegram-бот работает 24/7. Никаких звонков и ожидания на линии.",
    },
  ];

  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? "visible" : ""}`}>
        <p className="land-section-tag">Почему к нам возвращаются</p>
        <h2 className="land-h2">6 причин выбрать нас</h2>
        <div className="land-advantages-grid">
          {cards.map((card, idx) => (
            <div key={idx} className="land-advantage-card" style={{ animationDelay: `${idx * 0.08}s` }}>
              <span className="land-advantage-icon">{card.icon}</span>
              <strong className="land-advantage-title">{card.title}</strong>
              <p className="land-advantage-text">{card.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// УСЛУГИ
// ═══════════════════════════════════════════════════════════════

function ServicesSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.15 });

  const services = [
    {
      id: "laser",
      icon: "✦",
      title: "Лазерная эпиляция",
      description: "Долгосрочное снижение роста волос. Alma Soprano ICE — три длины волны, подходит для всех фототипов.",
      features: ["Снижение роста до 80–90% за курс", "Тёмные волосы на любой коже", "8–10 процедур", "Быстро: ноги — 40 мин"],
      price: "от 800 ₽",
      link: "/laser",
    },
    {
      id: "wax",
      icon: "◆",
      title: "Восковая депиляция",
      description: "Мгновенный результат для любого цвета волос. Плёночный воск ItalWax Premium — мягко и чисто.",
      features: ["Результат сразу после процедуры", "Любой цвет волос", "Эффект 3–5 недель", "Волоски от 2–3 мм"],
      price: "от 400 ₽",
      link: "/wax",
    },
    {
      id: "electro",
      icon: "◉",
      title: "Электроэпиляция",
      description: "Перманентное удаление — волосок за волоском. Единственный FDA-метод с постоянным результатом.",
      features: ["Навсегда по каждому фолликулу", "Светлые, рыжие, седые волосы", "Малые зоны и финализация", "Apilus xCell Pro"],
      price: "от 900 ₽",
      link: "/electro",
    },
  ];

  return (
    <section className="land-section land-section--alt" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? "visible" : ""}`}>
        <p className="land-section-tag">Наши услуги</p>
        <h2 className="land-h2">Три метода — один выбор</h2>
        <p className="land-services-subtitle">
          Расскажем на консультации, какой метод подойдёт именно вам. Честно и без давления.
        </p>
        <div className="land-services-cards">
          {services.map((service, idx) => (
            <div key={service.id} className="land-service-card" style={{ animationDelay: `${idx * 0.15}s` }}>
              <div className="land-service-card-header">
                <span className="land-service-card-icon">{service.icon}</span>
                <h3 className="land-service-card-title">{service.title}</h3>
              </div>
              <p className="land-service-card-description">{service.description}</p>
              <ul className="land-service-card-features">
                {service.features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <div className="land-service-card-footer">
                <span className="land-service-card-price">{service.price}</span>
                <Link to={service.link} className="land-service-card-btn">Подробнее →</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ДЛЯ ЖЕНЩИН И МУЖЧИН
// ═══════════════════════════════════════════════════════════════

function GenderSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.1 });

  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? "visible" : ""}`}>
        <p className="land-section-tag">Для всех</p>
        <h2 className="land-h2">Для женщин и мужчин</h2>
        <p className="land-services-subtitle">
          Принимаем всех без исключений. Мастера работают с мужскими зонами регулярно.
        </p>
        <div className="land-gender-grid">
          <div className="land-gender-card land-gender-card--women">
            <div className="land-gender-card-header">
              <h3>Женщинам</h3>
            </div>
            <div className="land-gender-zones">
              <div className="land-gender-zone-group">
                <span className="land-gender-zone-label">Лицо</span>
                <p>верхняя губа, подбородок, щёки, шея</p>
              </div>
              <div className="land-gender-zone-group">
                <span className="land-gender-zone-label">Тело</span>
                <p>подмышки, руки, ноги, живот, спина, ягодицы</p>
              </div>
              <div className="land-gender-zone-group">
                <span className="land-gender-zone-label">Интимные зоны</span>
                <p>бикини классическое, глубокое, тотальное</p>
              </div>
            </div>
          </div>

          <div className="land-gender-card land-gender-card--men">
            <div className="land-gender-card-header">
              <h3>Мужчинам</h3>
            </div>
            <div className="land-gender-zones">
              <div className="land-gender-zone-group">
                <span className="land-gender-zone-label">Лицо и шея</span>
                <p>контур бороды, шея, уши, брови</p>
              </div>
              <div className="land-gender-zone-group">
                <span className="land-gender-zone-label">Тело</span>
                <p>спина, плечи, грудь, живот, руки, ноги, ягодицы</p>
              </div>
              <div className="land-gender-zone-group">
                <span className="land-gender-zone-label">Интимные зоны</span>
                <p>паховая область, мошонка</p>
              </div>
            </div>
            <div className="land-gender-tags">
              <span className="land-gender-tag">гигиена</span>
              <span className="land-gender-tag">спорт</span>
              <span className="land-gender-tag">уверенность</span>
              <span className="land-gender-tag">аккуратный вид</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// МАССАЖ
// ═══════════════════════════════════════════════════════════════

function MassageSection({ botUrl }) {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.1 });

  const types = [
    {
      icon: "🤲",
      title: "Классический",
      desc: "Проработка мышц, улучшение кровообращения, повышение тонуса тела.",
      effect: "Снятие напряжения",
      for: "Для всех",
    },
    {
      icon: "🌿",
      title: "Расслабляющий",
      desc: "Ароматерапия, плавные движения, снижение стресса и улучшение сна.",
      effect: "Восстановление",
      for: "После нагрузок",
    },
    {
      icon: "⚡",
      title: "Спортивный",
      desc: "Интенсивная проработка мышц, ускорение восстановления после тренировок.",
      effect: "Восстановление",
      for: "Для спортсменов",
    },
    {
      icon: "💧",
      title: "Лимфодренажный",
      desc: "Стимуляция лимфотока, уменьшение отёков, коррекция контура тела.",
      effect: "Детокс",
      for: "При отёках",
    },
  ];

  return (
    <section className="land-section land-section--alt" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? "visible" : ""}`}>
        <p className="land-section-tag">Массаж</p>
        <h2 className="land-h2">Массаж для восстановления</h2>
        <p className="land-services-subtitle">
          Четыре вида массажа — для расслабления, спорта, лимфодренажа и общего тонуса.
        </p>
        <div className="land-massage-grid">
          {types.map((m, i) => (
            <div key={i} className="land-massage-card">
              <span className="land-massage-icon">{m.icon}</span>
              <h3 className="land-massage-title">{m.title}</h3>
              <p className="land-massage-desc">{m.desc}</p>
              <div className="land-massage-meta">
                <span className="land-massage-tag">{m.effect}</span>
                <span className="land-massage-tag">{m.for}</span>
              </div>
              <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-massage-btn">
                Записаться
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// МАСТЕРА
// ═══════════════════════════════════════════════════════════════

function MastersSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.2 });
  const masters = Object.entries(MASTERS_DATA);

  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? "visible" : ""}`}>
        <p className="land-section-tag">Команда</p>
        <h2 className="land-h2">Наши специалисты</h2>
        <div className="land-masters-grid">
          {masters.map(([name, data]) => (
            <div key={name} className="land-master-card">
              <div className="land-master-avatar-wrap">
                <img src={data.photo} alt={name} className="land-master-avatar" loading="lazy" />
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
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// БЛОК ДОВЕРИЯ
// ═══════════════════════════════════════════════════════════════

function AnimatedCounter({ target, suffix = "", duration = 1800 }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) { setStarted(true); observer.unobserve(el); } },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return <span ref={ref}>{count.toLocaleString("ru-RU")}{suffix}</span>;
}

function TrustSection() {
  const [refCerts, visibleCerts] = useScrollAnimation({ threshold: 0.1 });
  const [refGuars, visibleGuars] = useScrollAnimation({ threshold: 0.1 });

  const stats = [
    { target: 5,    suffix: " лет",  label: "работаем на рынке",     note: "С 2019 года" },
    { target: 1200, suffix: "+",     label: "клиентов за всё время", note: "Женщины и мужчины" },
    { target: 98,   suffix: "%",     label: "возвращаются снова",    note: "По данным CRM" },
    { target: 3,    suffix: "",      label: "метода депиляции",      note: "Лазер, воск, электро" },
  ];

  const certificates = [
    {
      icon: "🏅",
      title: "FDA Cleared",
      subtitle: "Alma Soprano ICE",
      desc: "Лазерная система сертифицирована Управлением по санитарному надзору США как безопасная и эффективная.",
    },
    {
      icon: "🇪🇺",
      title: "CE Medical",
      subtitle: "Alma Soprano ICE",
      desc: "Соответствие европейским стандартам качества и безопасности медицинских изделий.",
    },
    {
      icon: "🏅",
      title: "Health Canada",
      subtitle: "Apilus xCell Pro",
      desc: "Система электроэпиляции одобрена одним из строжайших регуляторов в мире.",
    },
    {
      icon: "🌿",
      title: "ItalWax Premium",
      subtitle: "Восковая депиляция",
      desc: "Профессиональная косметика европейского производства. Гипоаллергенные составы, дерматологически протестированы.",
    },
  ];

  const guarantees = [
    {
      icon: "🔁",
      title: "Бесплатная повторная процедура",
      desc: "Если после лазерного сеанса остались необработанные участки по вине мастера — повторим бесплатно.",
    },
    {
      icon: "💬",
      title: "Честная консультация",
      desc: "Не будем продавать курс, если метод вам не подходит. Скажем прямо — и предложим альтернативу.",
    },
    {
      icon: "🧴",
      title: "Только одноразовые расходники",
      desc: "Иглы для электроэпиляции — стерильные одноразовые, вскрываются при вас. Воск не используется повторно.",
    },
    {
      icon: "⚙️",
      title: "Индивидуальные параметры",
      desc: "Настраиваем оборудование под ваш фототип и тип волос на каждой процедуре — не по шаблону.",
    },
  ];

  return (
    <section className="trust-section">
      {/* Статистика */}
      <div className="trust-stats-bar">
        <div className="trust-stats-inner">
          {stats.map((s, i) => (
            <div className="trust-stat" key={i}>
              <div className="trust-stat-number">
                <AnimatedCounter target={s.target} suffix={s.suffix} duration={1600 + i * 100} />
              </div>
              <div className="trust-stat-label">{s.label}</div>
              <div className="trust-stat-note">{s.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Сертификаты */}
      <div className="trust-certs-wrap" ref={refCerts}>
        <div className={`trust-inner fade-in-up ${visibleCerts ? "visible" : ""}`}>
          <p className="land-section-tag">Оборудование</p>
          <h2 className="land-h2">Сертифицированная техника</h2>
          <p className="trust-section-sub">
            Работаем только на профессиональном оборудовании с международными сертификатами безопасности и эффективности.
          </p>
          <div className="trust-certs-grid">
            {certificates.map((cert, i) => (
              <div className="trust-cert-card" key={i}>
                <div className="trust-cert-top">
                  <span className="trust-cert-icon">{cert.icon}</span>
                  <div>
                    <div className="trust-cert-title">{cert.title}</div>
                    <div className="trust-cert-subtitle">{cert.subtitle}</div>
                  </div>
                </div>
                <p className="trust-cert-desc">{cert.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Гарантии */}
      <div className="trust-guarantees-wrap" ref={refGuars}>
        <div className={`trust-inner fade-in-up ${visibleGuars ? "visible" : ""}`}>
          <p className="land-section-tag">Наши обязательства</p>
          <h2 className="land-h2">Что мы гарантируем</h2>
          <p className="trust-section-sub">Не обещаем невозможного. Гарантируем то, что в наших силах.</p>
          <div className="trust-guarantees-grid">
            {guarantees.map((g, i) => (
              <div className="trust-guarantee-card" key={i}>
                <span className="trust-guarantee-icon">{g.icon}</span>
                <div>
                  <h3 className="trust-guarantee-title">{g.title}</h3>
                  <p className="trust-guarantee-desc">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ОТЗЫВЫ
// ═══════════════════════════════════════════════════════════════

function ReviewsSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.2 });

  const reviews = [
    {
      name: "Алина К.",
      text: "После первого сеанса лазерной эпиляции волоски стали значительно тоньше. Мастер всё объяснила, было совсем не больно!",
      stars: 5,
      tag: "Лазерная эпиляция",
    },
    {
      name: "Марина Д.",
      text: "Хожу на восковую депиляцию уже год — результат отличный. Удобная запись через бота, не нужно звонить.",
      stars: 5,
      tag: "Восковая депиляция",
    },
    {
      name: "Антон В.",
      text: "Сделал депиляцию спины — ожидал неловкости, но всё прошло профессионально и без лишних вопросов. Рекомендую.",
      stars: 5,
      tag: "Лазерная эпиляция",
    },
    {
      name: "Светлана П.",
      text: "Электроэпиляция помогла избавиться от светлых волосков, которые лазер не брал. Профессиональный подход!",
      stars: 5,
      tag: "Электроэпиляция",
    },
  ];

  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? "visible" : ""}`}>
        <p className="land-section-tag">Отзывы</p>
        <h2 className="land-h2">Что говорят клиенты</h2>
        <div className="land-reviews-grid">
          {reviews.map((r) => (
            <div key={r.name} className="land-review-card">
              <p className="land-review-stars">{"★".repeat(r.stars)}</p>
              <span className="land-review-tag">{r.tag}</span>
              <p className="land-review-text">«{r.text}»</p>
              <p className="land-review-name">{r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// FAQ
// ═══════════════════════════════════════════════════════════════

const FAQ_CATEGORIES = [
  { id: "general", label: "Общие" },
  { id: "laser",   label: "Лазер" },
  { id: "wax",     label: "Воск" },
  { id: "electro", label: "Электро" },
];

const FAQ_ITEMS = [
  {
    cat: "general",
    q: "Вы работаете с мужчинами?",
    a: "Да, принимаем женщин и мужчин без исключений. Мастера работают с мужскими зонами регулярно: спина, грудь, живот, ноги, борода. Нейтральная обстановка — это обычная процедура.",
  },
  {
    cat: "general",
    q: "Какой метод выбрать?",
    a: "Лазер — для долгосрочного снижения роста тёмных волос на больших зонах. Воск — мгновенный результат, любой цвет волос, без курса. Электро — перманентное удаление, незаменимо для светлых и седых волос. Расскажем на консультации честно и без давления.",
  },
  {
    cat: "general",
    q: "Можно ли записаться без звонка?",
    a: "Да — именно так мы и работаем. Запись через Telegram-бота в любое время. Никаких звонков и ожидания на линии.",
  },
  {
    cat: "laser",
    q: "Лазерная эпиляция — это навсегда?",
    a: "Честный ответ: нет. Лазер даёт долгосрочное снижение роста на 80–90%, а не 100% вечное удаление. После курса из 8–10 процедур у большинства остаётся 10–20% тонких и редких волос. Раз в 1–2 года может потребоваться поддерживающая процедура.",
  },
  {
    cat: "laser",
    q: "Больно ли делать лазерную эпиляцию?",
    a: "Soprano ICE охлаждает кожу в процессе работы. Большинство описывает ощущение как лёгкое тепло. Чувствительные зоны (бикини, верхняя губа) ощутимее — параметры настраиваем индивидуально.",
  },
  {
    cat: "laser",
    q: "Можно ли делать лазер летом?",
    a: "Да, круглый год. Условие: не загорать за 2 недели до и после, защищать обработанные зоны SPF 50+. Если вернулись из отпуска с загаром — подождите 2 недели.",
  },
  {
    cat: "wax",
    q: "Какой должна быть длина волос для воска?",
    a: "Оптимально 4–6 мм (около 1–1,5 недели после бритья). Плёночный воск ItalWax захватывает волоски от 2–3 мм, но для чистого результата лучше немного отрастить.",
  },
  {
    cat: "wax",
    q: "Будет ли раздражение после восковой депиляции?",
    a: "Лёгкое покраснение в первые 2–4 часа — нормальная реакция. Наносим успокаивающий крем сразу после процедуры. Через 3–4 дня начните мягкий скраб 1–2 раза в неделю — профилактика вросших волос.",
  },
  {
    cat: "electro",
    q: "Электроэпиляция — это действительно навсегда?",
    a: "Да — это единственный метод с FDA-статусом permanent hair removal. Разрушенный фолликул не восстанавливается. Оговорка: гормональные изменения могут активировать спящие фолликулы, поэтому единичные новые волоски через годы — возможны.",
  },
  {
    cat: "electro",
    q: "Почему лазер не взял мои волосы, а электро возьмёт?",
    a: "Лазер работает за счёт меланина в волосе. Светлые, рыжие, седые волосы содержат мало меланина — лазерный импульс проходит мимо фолликула. Электроэпиляция воздействует током напрямую — цвет волоса не имеет значения.",
  },
];

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item${open ? " faq-item--open" : ""}`}>
      <button className="faq-question" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{question}</span>
        <span className="faq-arrow" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="faq-answer">{answer}</div>}
    </div>
  );
}

function FaqSection() {
  const [activeTab, setActiveTab] = useState("general");
  const filtered = FAQ_ITEMS.filter((item) => item.cat === activeTab);

  return (
    <section className="faq-section">
      <div className="faq-inner">
        <div className="faq-header">
          <p className="land-section-tag">Вопросы и ответы</p>
          <h2 className="land-h2">Часто спрашивают</h2>
          <p className="faq-subtitle">Отвечаем честно — без маркетинга и преувеличений.</p>
        </div>
        <div className="faq-tabs" role="tablist">
          {FAQ_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={activeTab === cat.id}
              className={`faq-tab${activeTab === cat.id ? " faq-tab--active" : ""}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="faq-list" role="tabpanel">
          {filtered.map((item, i) => (
            <FaqItem key={`${activeTab}-${i}`} question={item.q} answer={item.a} />
          ))}
        </div>
        <div className="faq-footer">
          <p>Не нашли ответ на свой вопрос?</p>
          <a href="https://t.me/LaserBook_bot" target="_blank" rel="noopener noreferrer" className="faq-footer-link">
            Спросите в Telegram →
          </a>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// CTA
// ═══════════════════════════════════════════════════════════════

function CtaSection({ botUrl }) {
  return (
    <section className="land-cta">
      <div className="land-cta-inner">
        <h2 className="land-cta-title">Готовы к первой процедуре?</h2>
        <p className="land-cta-sub">Запишитесь онлайн за 2 минуты · Ответим на все вопросы в Telegram</p>
        <div className="landing-cta-buttons">
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-btn-telegram land-btn-telegram--light">
            Записаться онлайн
          </a>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// КОНТАКТЫ
// ═══════════════════════════════════════════════════════════════

function ContactsSection() {
  return (
    <section className="land-section land-section--alt">
      <div className="land-section-inner">
        <p className="land-section-tag">Контакты</p>
        <h2 className="land-h2">Как нас найти</h2>
        <div className="land-contacts-grid">
          <div className="land-contact-block">
            <h3 className="land-h3">Адрес</h3>
            <p>г. Москва, ул. Примерная, д. 1<br />ТЦ «Пример», 2 этаж</p>
          </div>
          <div className="land-contact-block">
            <h3 className="land-h3">Режим работы</h3>
            <p>Пн–Вс: 10:00 – 20:00<br />Без выходных</p>
          </div>
          <div className="land-contact-block">
            <h3 className="land-h3">Связь</h3>
            <p>Telegram: @LaserBook_bot<br />Запись онлайн 24/7</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ГЛАВНАЯ СТРАНИЦА
// ═══════════════════════════════════════════════════════════════

export function HomePage({ botUrl, isAdmin, session, onAdminClick, onLoginClick, onSignOut }) {
  return (
    <div className="land-root">
      <AdminBar
        isAdmin={isAdmin}
        session={session}
        onAdminClick={onAdminClick}
        onLoginClick={onLoginClick}
        onSignOut={onSignOut}
      />
      <StickyBookButton botUrl={botUrl} />
      <HeroSection botUrl={botUrl} />
      <WhyUsSection />
      <ServicesSection />
      <GenderSection />
      <MassageSection botUrl={botUrl} />
      <MastersSection />
      <TrustSection />
      <ReviewsSection />
      <FaqSection />
      <CtaSection botUrl={botUrl} />
      <ContactsSection />
    </div>
  );
}
