import { MASTERS_DATA } from "../App.jsx";
import { useScrollAnimation } from "./useScrollAnimation.js";

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
            Записаться в Telegram
          </a>
        </div>
        <p className="land-hero-hint">Запись через Telegram · Без звонков</p>
      </div>
    </section>
  );
}

// Блок 1.5 — Навигация по услугам (якорные ссылки)
function ServicesNavSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.2 });
  
  const services = [
    { id: "laser", icon: "✨", title: "Лазерная эпиляция" },
    { id: "wax", icon: "🌿", title: "Восковая депиляция" },
    { id: "electro", icon: "⚡", title: "Электроэпиляция" },
  ];

  const scrollToService = (id) => {
    const element = document.getElementById(`service-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="land-services-nav" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? 'visible' : ''}`}>
        <p className="land-section-tag">Наши услуги</p>
        <h2 className="land-h2">Выберите подходящий метод</h2>
        <div className="land-services-nav-grid">
          {services.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              className="land-service-nav-card"
              onClick={() => scrollToService(s.id)}
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <span className="land-service-nav-icon">{s.icon}</span>
              <span className="land-service-nav-title">{s.title}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок 2 — Лазерная эпиляция
function LaserSection() {
  return (
    <section id="service-laser" className="land-section land-section--service">
      <div className="land-section-inner">
        <div className="land-service-header">
          <span className="land-service-icon">✨</span>
          <div>
            <p className="land-section-tag">Лазерная эпиляция</p>
            <h2 className="land-h2">Избавьтесь от нежелательных волос навсегда</h2>
          </div>
        </div>

        <div className="land-service-content">
          <div className="land-service-block">
            <h3 className="land-h3">Принцип работы</h3>
            <p className="land-service-text">
              Диодный лазер воздействует световым импульсом на меланин в волосяном фолликуле. 
              Энергия света преобразуется в тепло, разрушая корень волоса без повреждения кожи. 
              Встроенная система охлаждения делает процедуру комфортной даже на чувствительных зонах.
            </p>
          </div>

          <div className="land-service-block">
            <h3 className="land-h3">Преимущества метода</h3>
            <ul className="land-service-benefits">
              <li>
                <strong>Долговременный эффект</strong> — до 95% волос не возвращается после полного курса из 8–10 сеансов
              </li>
              <li>
                <strong>Безболезненно</strong> — система охлаждения Peltier снижает дискомфорт до минимума
              </li>
              <li>
                <strong>Быстро</strong> — зона подмышек за 5 минут, ноги полностью за 40 минут
              </li>
              <li>
                <strong>Безопасно для любой кожи</strong> — подходит для светлой и смуглой кожи (фототипы I–VI)
              </li>
              <li>
                <strong>Без вросших волос</strong> — в отличие от бритья и воска, предотвращает врастание
              </li>
            </ul>
          </div>

          <div className="land-service-block">
            <h3 className="land-h3">Результат</h3>
            <p className="land-service-text">
              После первой процедуры волосы становятся тоньше и светлее, замедляется их рост. 
              Полный курс из 8–10 сеансов обеспечивает гладкость кожи на годы. Интервал между 
              процедурами — 4–6 недель.
            </p>
          </div>

          <div className="land-service-block land-service-block--highlight">
            <h3 className="land-h3">Для кого</h3>
            <p className="land-service-text">
              Идеально для тех, кто устал от ежедневного бритья, восковых депиляций 
              и хочет долговременное решение проблемы нежелательных волос. Подходит 
              для любых зон тела.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Блок 3 — Восковая депиляция
function WaxSection() {
  return (
    <section id="service-wax" className="land-section land-section--service">
      <div className="land-section-inner">
        <div className="land-service-header">
          <span className="land-service-icon">🌿</span>
          <div>
            <p className="land-section-tag">Восковая депиляция</p>
            <h2 className="land-h2">Гладкая кожа здесь и сейчас</h2>
          </div>
        </div>

        <div className="land-service-content">
          <div className="land-service-block">
            <h3 className="land-h3">Что это</h3>
            <p className="land-service-text">
              Классический метод удаления волос с корнем при помощи тёплого воска. 
              Один из самых быстрых способов получить идеально гладкую кожу на 3–4 недели. 
              Используем профессиональные европейские составы с успокаивающими компонентами.
            </p>
          </div>

          <div className="land-service-block">
            <h3 className="land-h3">Преимущества</h3>
            <ul className="land-service-benefits">
              <li>
                <strong>Мгновенный результат</strong> — идеально гладкая кожа сразу после процедуры
              </li>
              <li>
                <strong>Доступно</strong> — подходит для любого бюджета, отличное соотношение цены и эффекта
              </li>
              <li>
                <strong>Эффект до месяца</strong> — волосы отрастают медленнее и тоньше, чем после бритья
              </li>
              <li>
                <strong>Профессиональный воск</strong> — составы премиум-класса с азуленом для чувствительной кожи
              </li>
              <li>
                <strong>Подходит для светлых волос</strong> — работает на любом цвете и толщине волос
              </li>
            </ul>
          </div>

          <div className="land-service-block">
            <h3 className="land-h3">Особенности</h3>
            <p className="land-service-text">
              Процедура проводится на волосках длиной от 4–5 мм. Используем тёплый воск, 
              температура которого комфортна для кожи. После процедуры наносим успокаивающее 
              средство, которое предотвращает раздражение.
            </p>
          </div>

          <div className="land-service-block land-service-block--highlight">
            <h3 className="land-h3">Для кого</h3>
            <p className="land-service-text">
              Отлично подходит для подготовки к важному событию, отпуску или как регулярный 
              метод поддержания гладкости. Также рекомендуется между лазерными сеансами 
              для тех, кто проходит курс лазерной эпиляции.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Блок 4 — Электроэпиляция
function ElectroSection() {
  return (
    <section id="service-electro" className="land-section land-section--service">
      <div className="land-section-inner">
        <div className="land-service-header">
          <span className="land-service-icon">⚡</span>
          <div>
            <p className="land-section-tag">Электроэпиляция</p>
            <h2 className="land-h2">Индивидуальный подход к каждому волоску</h2>
          </div>
        </div>

        <div className="land-service-content">
          <div className="land-service-block">
            <h3 className="land-h3">Принцип работы</h3>
            <p className="land-service-text">
              Тончайшая игла-электрод вводится в волосяной фолликул, слабый электрический 
              разряд разрушает корень навсегда. Единственный метод, одобренный FDA как 
              перманентное (постоянное) удаление волос.
            </p>
          </div>

          <div className="land-service-block">
            <h3 className="land-h3">Преимущества</h3>
            <ul className="land-service-benefits">
              <li>
                <strong>Удаление навсегда</strong> — разрушенный фолликул больше не производит волос
              </li>
              <li>
                <strong>Для любых волос</strong> — работает на светлых, седых, рыжих волосах (где лазер бессилен)
              </li>
              <li>
                <strong>Для любой кожи</strong> — безопасно даже для очень светлой или тёмной кожи
              </li>
              <li>
                <strong>Точечная работа</strong> — идеально для небольших зон: верхняя губа, подбородок, брови
              </li>
              <li>
                <strong>Универсальность</strong> — единственный метод для пушковых и очень тонких волос
              </li>
            </ul>
          </div>

          <div className="land-service-block">
            <h3 className="land-h3">Особенности</h3>
            <p className="land-service-text">
              Процедура требует больше времени, чем лазерная эпиляция, так как каждый 
              волосок обрабатывается индивидуально. Рекомендуется для небольших зон 
              или финальной доработки после курса лазерной эпиляции.
            </p>
          </div>

          <div className="land-service-block land-service-block--highlight">
            <h3 className="land-h3">Для кого</h3>
            <p className="land-service-text">
              Идеальна для тех, у кого светлые, седые или рыжие волосы, с которыми 
              лазер не справляется. Отлично подходит для финальной доработки после 
              лазера, коррекции формы бровей и удаления гормональных волосков на лице.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Блок 5 — Оборудование
function EquipmentSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.15 });
  
  const features = [
    {
      icon: "🔬",
      title: "Диодный лазер последнего поколения",
      items: [
        "Длина волны 808 нм — золотой стандарт для всех типов кожи",
        "Мощность до 3000 Вт — быстрая обработка больших зон",
        "Сертификация CE Medical, FDA — международные стандарты безопасности",
      ],
    },
    {
      icon: "❄️",
      title: "Контактное охлаждение Peltier",
      items: [
        "Температура манипулы снижается до -5°C во время процедуры",
        "Защита эпидермиса от перегрева",
        "Комфорт даже на чувствительных зонах",
      ],
    },
    {
      icon: "🛡️",
      title: "Безопасность и гигиена",
      items: [
        "Одноразовые расходники для каждого клиента",
        "Стерилизация оборудования после каждой процедуры",
        "Регулярное техническое обслуживание аппаратов",
        "Обязательная защита глаз во время лазерных процедур",
      ],
    },
    {
      icon: "🌈",
      title: "Для всех типов кожи",
      items: [
        "Работаем с фототипами I–VI по Фитцпатрику",
        "От очень светлой до тёмной кожи",
        "Индивидуальная настройка параметров под каждого клиента",
      ],
    },
  ];

  return (
    <section className="land-section land-section--alt" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? 'visible' : ''}`}>
        <p className="land-section-tag">Оборудование</p>
        <h2 className="land-h2">Работаем на аппаратах последнего поколения</h2>
        <p className="land-equipment-subtitle">
          Инвестируем в технологии, чтобы ваши процедуры были безопасными, 
          комфортными и максимально эффективными
        </p>
        
        <div className="land-equipment-grid">
          {features.map((feature, idx) => (
            <div 
              key={feature.title} 
              className="land-equipment-card"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="land-equipment-icon">{feature.icon}</div>
              <h3 className="land-equipment-title">{feature.title}</h3>
              <ul className="land-equipment-list">
                {feature.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок 6 — FAQ
function FAQSection() {
  const faqs = [
    {
      q: "Больно ли делать лазерную эпиляцию?",
      a: "Благодаря системе охлаждения процедура комфортна. Ощущения — лёгкое покалывание или тепло. Большинство клиентов отмечают, что это значительно менее болезненно, чем воск или шугаринг.",
    },
    {
      q: "Сколько нужно сеансов?",
      a: "В среднем 8–10 сеансов для полного курса. Точное количество зависит от зоны обработки, типа кожи, цвета и толщины волос, гормонального фона. После консультации мастер составит индивидуальный план.",
    },
    {
      q: "Можно ли делать летом?",
      a: "Да, но с обязательной защитой от солнца SPF 50+ за 2 недели до и 2 недели после процедуры. Нельзя загорать и посещать солярий в этот период.",
    },
    {
      q: "Как подготовиться к процедуре?",
      a: "За сутки побрить зону бритвой. За месяц не делать шугаринг или воск. За 2 недели не загорать. Прийти с чистой кожей без кремов. Подробные рекомендации дадим при записи.",
    },
    {
      q: "Есть ли противопоказания?",
      a: "Абсолютные: онкология, фотодерматозы, приём фотосенсибилизирующих препаратов. Относительные: свежий загар, беременность, воспаления на коже. На консультации мастер оценит возможность проведения процедуры.",
    },
    {
      q: "Чем отличается лазер от электроэпиляции?",
      a: "Лазер быстрее и подходит для больших зон, работает с тёмными волосами. Электроэпиляция медленнее, но справляется со светлыми, седыми волосами и идеальна для небольших зон и финальной доработки.",
    },
  ];

  return (
    <section className="land-section">
      <div className="land-section-inner">
        <p className="land-section-tag">Частые вопросы</p>
        <h2 className="land-h2">Ответы на популярные вопросы</h2>
        
        <div className="land-faq-list">
          {faqs.map((faq, idx) => (
            <details key={idx} className="land-faq-item">
              <summary className="land-faq-question">{faq.q}</summary>
              <p className="land-faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок 2 — Почему лазер (ПЕРЕИМЕНОВЫВАЕМ из WhySection)
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
        <p className="land-section-tag">Преимущества</p>
        <h2 className="land-h2">Почему выбирают лазерную эпиляцию</h2>
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

// Блок 7 — Как проходит процедура
function HowSection() {
  const steps = [
    { n: "01", title: "Консультация",   text: "Обсуждаем зоны, тип кожи и волос. Отвечаем на все вопросы." },
    { n: "02", title: "Подготовка",     text: "Наносим охлаждающий гель, настраиваем лазер индивидуально." },
    { n: "03", title: "Процедура",      text: "Мягкие импульсы лазера воздействуют на фолликулы. Ощущение — лёгкое тепло." },
    { n: "04", title: "Уход после",     text: "Рекомендации по уходу. Результат заметен через 2–3 недели." },
  ];
  return (
    <section className="land-section">
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

// Блок 8 — Подготовка к процедурам
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

// Блок 9 — Мастера
function MastersSection({ botUrl }) {
  const masters = Object.entries(MASTERS_DATA);
  return (
    <section className="land-section">
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
      </div>
    </section>
  );
}

// Блок 10 — Отзывы
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

// Блок 11 — CTA
function CtaSection({ botUrl }) {
  return (
    <section className="land-cta">
      <div className="land-cta-inner">
        <h2 className="land-cta-title">Готовы к первому сеансу?</h2>
        <p className="land-cta-sub">Запишитесь онлайн за 2 минуты · Ответим на все вопросы в Telegram</p>
        <div className="landing-cta-buttons">
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-btn-telegram land-btn-telegram--light">
            Записаться в Telegram
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
      <ServicesNavSection />
      <LaserSection />
      <WaxSection />
      <ElectroSection />
      <WhySection />
      <EquipmentSection />
      <FAQSection />
      <HowSection />
      <PrepSection />
      <MastersSection botUrl={botUrl} />
      <ReviewsSection />
      <CtaSection botUrl={botUrl} />
    </div>
  );
}
