import { Link } from "react-router-dom";
import { MASTERS_DATA } from "../App.jsx";
import { StickyBookButton } from "../components/StickyBookButton.jsx";
import { useScrollAnimation } from "../components/useScrollAnimation.js";

// Админ-бар
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

// Hero секция
function HeroSection({ botUrl }) {
  return (
    <section className="land-hero">
      <div className="land-hero-bg" aria-hidden="true">
        <div className="land-hero-circle land-hero-circle--1" />
        <div className="land-hero-circle land-hero-circle--2" />
      </div>
      <div className="land-hero-content">
        <p className="land-eyebrow">Студия профессиональной депиляции</p>
        <h1 className="land-h1">
          Гладкая кожа —<br />
          <span className="land-h1-accent">навсегда</span>
        </h1>
        <p className="land-hero-sub">
          Диодный лазер последнего поколения, профессиональные воски и электроэпиляция. 
          Безболезненно, безопасно, с гарантией результата.
        </p>
        <div className="landing-cta-buttons">
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="land-btn-telegram">
            Записаться онлайн
          </a>
        </div>
        <p className="land-hero-hint">Запись через Telegram · Без звонков</p>
      </div>
    </section>
  );
}

// Преимущества салона
function AdvantagesSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.2 });
  
  const advantages = [
    { 
      icon: "🏆", 
      title: "Опыт более 5 лет", 
      text: "Сертифицированные специалисты с медицинским образованием" 
    },
    { 
      icon: "⚡", 
      title: "Быстро и эффективно", 
      text: "Современное оборудование последнего поколения" 
    },
    { 
      icon: "💎", 
      title: "Премиум материалы", 
      text: "Используем профессиональную косметику европейских брендов" 
    },
    { 
      icon: "✨", 
      title: "Гарантия результата", 
      text: "Индивидуальный подход и контроль на каждом этапе" 
    },
  ];

  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? 'visible' : ''}`}>
        <p className="land-section-tag">Почему мы</p>
        <h2 className="land-h2">Ваша уверенность в надёжных руках</h2>
        <div className="land-advantages-grid">
          {advantages.map((item, idx) => (
            <div key={item.title} className="land-advantage-card" style={{ animationDelay: `${idx * 0.1}s` }}>
              <span className="land-advantage-icon">{item.icon}</span>
              <strong className="land-advantage-title">{item.title}</strong>
              <p className="land-advantage-text">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок услуг с карточками и кнопками "Подробнее"
function ServicesSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.15 });
  
  const services = [
    {
      id: "laser",
      icon: "✨",
      title: "Лазерная эпиляция",
      description: "Диодный лазер последнего поколения для безболезненного удаления волос навсегда",
      features: [
        "Эффект до 95% после курса",
        "Без боли благодаря охлаждению",
        "Для любого типа кожи",
        "Курс 8–10 процедур"
      ],
      price: "от 2500 ₽",
      link: "/laser"
    },
    {
      id: "wax",
      icon: "🌿",
      title: "Восковая депиляция",
      description: "Профессиональные плёночные воски для мгновенной гладкости на 3–4 недели",
      features: [
        "Результат сразу после процедуры",
        "Гипоаллергенные составы",
        "Минимум раздражения",
        "Подходит для светлых волос"
      ],
      price: "от 1200 ₽",
      link: "/wax"
    },
    {
      id: "electro",
      icon: "⚡",
      title: "Электроэпиляция",
      description: "Точечное удаление навсегда — для светлых, седых и пушковых волос",
      features: [
        "Удаление навсегда",
        "Работает с любым цветом волос",
        "Идеально для малых зон",
        "FDA-одобренный метод"
      ],
      price: "от 1800 ₽",
      link: "/electro"
    }
  ];

  return (
    <section className="land-section land-section--alt" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? 'visible' : ''}`}>
        <p className="land-section-tag">Наши услуги</p>
        <h2 className="land-h2">Выберите метод для идеальной гладкости</h2>
        <p className="land-services-subtitle">
          Мы предлагаем три профессиональных метода депиляции. 
          Каждый имеет свои преимущества — поможем выбрать подходящий.
        </p>
        
        <div className="land-services-cards">
          {services.map((service, idx) => (
            <div 
              key={service.id} 
              className="land-service-card"
              style={{ animationDelay: `${idx * 0.15}s` }}
            >
              <div className="land-service-card-header">
                <span className="land-service-card-icon">{service.icon}</span>
                <h3 className="land-service-card-title">{service.title}</h3>
              </div>
              
              <p className="land-service-card-description">{service.description}</p>
              
              <ul className="land-service-card-features">
                {service.features.map((feature, i) => (
                  <li key={i}>{feature}</li>
                ))}
              </ul>
              
              <div className="land-service-card-footer">
                <span className="land-service-card-price">{service.price}</span>
                <Link to={service.link} className="land-service-card-btn">
                  Подробнее →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Блок оборудования
function EquipmentSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.15 });
  
  const equipment = [
    {
      id: "laser",
      title: "Alma Lasers Soprano ICE",
      category: "Лазерная эпиляция",
      description: "Диодный лазер с технологией SHR и тройным охлаждением. Безболезненные процедуры для всех фототипов кожи.",
      features: [
        "3 длины волны (755, 808, 1064 нм)",
        "Контактное охлаждение до -5°C",
        "Для светлой и тёмной кожи",
        "Сертификация FDA и CE"
      ]
    },
    {
      id: "electro",
      title: "Apilus xCell Pro",
      category: "Электроэпиляция",
      description: "Профессиональная система электроэпиляции для перманентного удаления любых волос — светлых, седых, пушковых.",
      features: [
        "27,12 МГц высокочастотный ток",
        "Минимальный дискомфорт",
        "Работает с любым цветом волос",
        "Точечная обработка фолликулов"
      ]
    },
    {
      id: "wax",
      title: "ItalWax Premium",
      category: "Восковая депиляция",
      description: "Профессиональные плёночные воски с натуральными маслами для комфортной депиляции без раздражения.",
      features: [
        "Гипоаллергенные составы",
        "Низкая температура плавления",
        "Захватывает короткие волоски (2-3 мм)",
        "Минимизация вросших волос"
      ]
    }
  ];

  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? 'visible' : ''}`}>
        <p className="land-section-tag">Оборудование</p>
        <h2 className="land-h2">Работаем на профессиональном оборудовании</h2>
        <p className="land-equipment-intro">
          Инвестируем в технологии последнего поколения, чтобы ваши процедуры были 
          максимально эффективными, безопасными и комфортными.
        </p>

        <div className="land-equipment-cards">
          {equipment.map((item, idx) => (
            <div 
              key={item.id} 
              className="land-equipment-card-full"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="land-equipment-placeholder">
                <span className="land-equipment-model">{item.title}</span>
              </div>
              
              <div className="land-equipment-content">
                <span className="land-equipment-category">{item.category}</span>
                <h3 className="land-equipment-title-card">{item.title}</h3>
                <p className="land-equipment-description">{item.description}</p>
                
                <ul className="land-equipment-features">
                  {item.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Мастера
function MastersSection({ botUrl }) {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.2 });
  const masters = Object.entries(MASTERS_DATA);
  
  return (
    <section className="land-section land-section--alt" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? 'visible' : ''}`}>
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

// Отзывы
function ReviewsSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.2 });
  
  const reviews = [
    { name: "Алина К.", text: "После первого сеанса лазерной эпиляции волоски стали значительно тоньше. Мастер всё объяснила, было совсем не больно!", stars: 5 },
    { name: "Марина Д.", text: "Хожу на восковую депиляцию уже год — результат отличный. Удобная запись через бота, не нужно звонить.", stars: 5 },
    { name: "Светлана П.", text: "Электроэпиляция помогла избавиться от светлых волосков, которые лазер не брал. Профессиональный подход!", stars: 5 },
  ];
  
  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? 'visible' : ''}`}>
        <p className="land-section-tag">Отзывы</p>
        <h2 className="land-h2">Что говорят наши клиентки</h2>
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

// CTA
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

// Контакты
function ContactsSection() {
  return (
    <section className="land-section land-section--alt">
      <div className="land-section-inner">
        <p className="land-section-tag">Контакты</p>
        <h2 className="land-h2">Как нас найти</h2>
        
        <div className="land-contacts-grid">
          <div className="land-contact-block">
            <h3 className="land-h3">Адрес</h3>
            <p>г. Москва, ул. Примерная, д. 1<br/>ТЦ "Пример", 2 этаж</p>
          </div>
          
          <div className="land-contact-block">
            <h3 className="land-h3">Режим работы</h3>
            <p>Пн-Вс: 10:00 – 20:00<br/>Без выходных</p>
          </div>
          
          <div className="land-contact-block">
            <h3 className="land-h3">Связь</h3>
            <p>Telegram: @LaserBook_bot<br/>Запись онлайн 24/7</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// Главная страница
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
      <AdvantagesSection />
      <ServicesSection />
      <EquipmentSection />
      <MastersSection botUrl={botUrl} />
      <ReviewsSection />
      <CtaSection botUrl={botUrl} />
      <ContactsSection />
    </div>
  );
}
