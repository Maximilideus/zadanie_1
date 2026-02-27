import { Link } from "react-router-dom";
import { useScrollAnimation } from "../components/useScrollAnimation.js";

export function LaserPage({ botUrl }) {
  const [ref1, isVisible1] = useScrollAnimation({ threshold: 0.2 });
  const [ref2, isVisible2] = useScrollAnimation({ threshold: 0.2 });
  const [ref3, isVisible3] = useScrollAnimation({ threshold: 0.2 });

  return (
    <div className="service-page">
      {/* Навигация */}
      <nav className="service-nav">
        <div className="service-nav-inner">
          <Link to="/" className="service-nav-back">← Главная</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="service-hero">
        <div className="service-hero-content">
          <span className="service-eyebrow">✨ Лазерная эпиляция</span>
          <h1 className="service-h1">Избавьтесь от нежелательных волос навсегда</h1>
          <p className="service-lead">
            Диодный лазер Alma Lasers Soprano ICE — технология нового поколения для безболезненного 
            удаления волос на любых участках тела. Подходит для всех типов кожи и волос.
          </p>
          <div className="service-hero-actions">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              📱 Записаться онлайн
            </a>
            <span className="service-price-badge">от 2500 ₽</span>
          </div>
        </div>
      </section>

      {/* Что это такое */}
      <section className="service-section" ref={ref1}>
        <div className={`service-section-inner fade-in-up ${isVisible1 ? 'visible' : ''}`}>
          <h2 className="service-h2">Что такое лазерная эпиляция</h2>
          <div className="service-content-grid">
            <div className="service-text-block">
              <p>
                Лазерная эпиляция — это современный метод удаления нежелательных волос, 
                основанный на воздействии световой энергии на меланин в волосяных фолликулах. 
                Лазерный луч проникает в кожу, нагревает волосяную луковицу и разрушает её, 
                не повреждая окружающие ткани.
              </p>
              <p>
                Мы используем <strong>диодный лазер Alma Lasers Soprano ICE</strong> — один из 
                самых эффективных и безопасных аппаратов на рынке. Технология SHR (Super Hair Removal) 
                обеспечивает комфортные процедуры даже на чувствительных зонах.
              </p>
            </div>
            <div className="service-highlight-box">
              <h3 className="service-h3">Принцип работы</h3>
              <ul className="service-list">
                <li>Световой импульс поглощается меланином волоса</li>
                <li>Энергия преобразуется в тепло</li>
                <li>Фолликул разрушается, рост волос прекращается</li>
                <li>Кожа остаётся неповреждённой благодаря охлаждению</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Как проходит процедура */}
      <section className="service-section service-section--alt">
        <div className="service-section-inner">
          <h2 className="service-h2">Как проходит процедура</h2>
          <div className="service-steps">
            <div className="service-step">
              <span className="service-step-number">01</span>
              <div>
                <h3 className="service-step-title">Консультация</h3>
                <p className="service-step-text">
                  Мастер оценивает тип кожи и волос, определяет зоны обработки, 
                  отвечает на ваши вопросы и составляет индивидуальный план процедур.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">02</span>
              <div>
                <h3 className="service-step-title">Подготовка</h3>
                <p className="service-step-text">
                  Наносим охлаждающий гель, надеваем защитные очки. 
                  Настраиваем параметры лазера индивидуально под ваш фототип.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">03</span>
              <div>
                <h3 className="service-step-title">Обработка зоны</h3>
                <p className="service-step-text">
                  Плавно обрабатываем зону манипулой с системой охлаждения. 
                  Вы ощущаете лёгкое тепло — процедура комфортна и безболезненна.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">04</span>
              <div>
                <h3 className="service-step-title">Завершение</h3>
                <p className="service-step-text">
                  Наносим успокаивающее средство, даём рекомендации по уходу. 
                  Результат становится заметен через 10–14 дней.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="service-section" ref={ref2}>
        <div className={`service-section-inner fade-in-up ${isVisible2 ? 'visible' : ''}`}>
          <h2 className="service-h2">Преимущества лазерной эпиляции</h2>
          <div className="service-benefits-grid">
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🎯</span>
              <h3 className="service-benefit-title">Долговременный эффект</h3>
              <p>До 95% волос не возвращается после полного курса из 8–10 процедур. 
              Результат сохраняется годами.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">❄️</span>
              <h3 className="service-benefit-title">Без боли</h3>
              <p>Встроенная система охлаждения Soprano ICE снижает температуру кожи до -5°C. 
              Процедура комфортна даже на чувствительных зонах.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">⚡</span>
              <h3 className="service-benefit-title">Быстро</h3>
              <p>Зона подмышек — 5 минут, голени — 20 минут, полностью ноги — 40 минут. 
              Экономьте своё время.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🌈</span>
              <h3 className="service-benefit-title">Для любой кожи</h3>
              <p>Три длины волны (755, 808, 1064 нм) позволяют работать с фототипами I–VI — 
              от очень светлой до тёмной кожи.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">✨</span>
              <h3 className="service-benefit-title">Без вросших волос</h3>
              <p>Лазер разрушает фолликул, предотвращая врастание. 
              Кожа остаётся гладкой и здоровой.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🛡️</span>
              <h3 className="service-benefit-title">Безопасно</h3>
              <p>Сертификация FDA и CE Medical. Одобрено международными стандартами 
              безопасности и эффективности.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Для каких зон подходит */}
      <section className="service-section service-section--alt">
        <div className="service-section-inner">
          <h2 className="service-h2">Для каких зон подходит</h2>
          <div className="service-zones-grid">
            <div className="service-zone-category">
              <h3 className="service-h3">Лицо</h3>
              <ul className="service-zone-list">
                <li>Верхняя губа</li>
                <li>Подбородок</li>
                <li>Щёки</li>
                <li>Брови (коррекция)</li>
              </ul>
            </div>
            <div className="service-zone-category">
              <h3 className="service-h3">Тело</h3>
              <ul className="service-zone-list">
                <li>Подмышки</li>
                <li>Руки (полностью или предплечья)</li>
                <li>Ноги (полностью, голени, бёдра)</li>
                <li>Спина</li>
                <li>Живот</li>
                <li>Грудь</li>
              </ul>
            </div>
            <div className="service-zone-category">
              <h3 className="service-h3">Интимные зоны</h3>
              <ul className="service-zone-list">
                <li>Бикини классическое</li>
                <li>Бикини глубокое</li>
                <li>Тотальное бикини</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="service-section" ref={ref3}>
        <div className={`service-section-inner fade-in-up ${isVisible3 ? 'visible' : ''}`}>
          <h2 className="service-h2">Частые вопросы</h2>
          <div className="service-faq">
            <details className="service-faq-item">
              <summary className="service-faq-question">Больно ли делать лазерную эпиляцию?</summary>
              <p className="service-faq-answer">
                Благодаря системе контактного охлаждения Soprano ICE процедура практически безболезненна. 
                Вы ощущаете лёгкое тепло или лёгкое покалывание. Это значительно комфортнее, 
                чем воск или шугаринг.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Сколько нужно процедур?</summary>
              <p className="service-faq-answer">
                В среднем 8–10 процедур с интервалом 4–6 недель. Точное количество зависит от зоны, 
                типа кожи, цвета и толщины волос, гормонального фона. После первых 2–3 сеансов 
                результат уже заметен.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Можно ли делать летом?</summary>
              <p className="service-faq-answer">
                Да, но важно защищать кожу от солнца SPF 50+ за 2 недели до и 2 недели после процедуры. 
                Нельзя загорать и посещать солярий в этот период.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Как подготовиться?</summary>
              <p className="service-faq-answer">
                За сутки до процедуры побрейте зону бритвой (длина волос должна быть 1–2 мм). 
                За месяц не делайте шугаринг или воск — только бритьё. За 2 недели не загорайте. 
                Приходите с чистой кожей без кремов и дезодорантов.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Есть ли противопоказания?</summary>
              <p className="service-faq-answer">
                Абсолютные: онкологические заболевания, фотодерматозы, приём фотосенсибилизирующих препаратов. 
                Относительные: свежий загар (менее 14 дней), беременность и лактация, воспаления на коже. 
                На консультации мастер оценит возможность проведения процедуры.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Какой результат после первой процедуры?</summary>
              <p className="service-faq-answer">
                После первого сеанса волосы начинают выпадать через 10–14 дней. Они становятся тоньше, 
                светлее, растут медленнее. С каждой процедурой эффект усиливается.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="service-cta">
        <div className="service-cta-inner">
          <h2 className="service-cta-title">Запишитесь на первую процедуру</h2>
          <p className="service-cta-text">
            Консультация бесплатная. Ответим на все вопросы, подберём индивидуальный план, 
            проведём тест-вспышку на небольшом участке.
          </p>
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-cta">
            📱 Записаться через Telegram
          </a>
        </div>
      </section>
    </div>
  );
}
