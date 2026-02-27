import { Link } from "react-router-dom";
import { useScrollAnimation } from "../components/useScrollAnimation.js";

export function WaxPage({ botUrl }) {
  const [ref1, isVisible1] = useScrollAnimation({ threshold: 0.2 });
  const [ref2, isVisible2] = useScrollAnimation({ threshold: 0.2 });

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
          <span className="service-eyebrow">🌿 Восковая депиляция</span>
          <h1 className="service-h1">Гладкая кожа здесь и сейчас</h1>
          <p className="service-lead">
            Профессиональные плёночные воски ItalWax Premium для комфортной депиляции. 
            Мгновенный результат, который держится 3–4 недели.
          </p>
          <div className="service-hero-actions">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              📱 Записаться онлайн
            </a>
            <span className="service-price-badge">от 1200 ₽</span>
          </div>
        </div>
      </section>

      {/* Что это */}
      <section className="service-section" ref={ref1}>
        <div className={`service-section-inner fade-in-up ${isVisible1 ? 'visible' : ''}`}>
          <h2 className="service-h2">Что такое восковая депиляция</h2>
          <div className="service-content-grid">
            <div className="service-text-block">
              <p>
                Восковая депиляция — классический метод удаления нежелательных волос с корнем 
                при помощи профессионального воска. Один из самых быстрых и доступных способов 
                получить идеально гладкую кожу на несколько недель.
              </p>
              <p>
                Мы используем <strong>плёночные воски ItalWax Premium</strong> — профессиональную 
                косметику европейского производства с натуральными маслами и смолами. 
                Гипоаллергенные составы минимизируют раздражение даже на чувствительной коже.
              </p>
            </div>
            <div className="service-highlight-box">
              <h3 className="service-h3">Как это работает</h3>
              <ul className="service-list">
                <li>Воск наносится на кожу тонким слоем</li>
                <li>Застывает, обволакивая каждый волосок</li>
                <li>Удаляется резким движением вместе с волосами</li>
                <li>Кожа остаётся гладкой 3–4 недели</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Как проходит */}
      <section className="service-section service-section--alt">
        <div className="service-section-inner">
          <h2 className="service-h2">Как проходит процедура</h2>
          <div className="service-steps">
            <div className="service-step">
              <span className="service-step-number">01</span>
              <div>
                <h3 className="service-step-title">Подготовка кожи</h3>
                <p className="service-step-text">
                  Обрабатываем зону антисептиком, наносим тальк для лучшего сцепления 
                  воска с волосками и защиты кожи.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">02</span>
              <div>
                <h3 className="service-step-title">Нанесение воска</h3>
                <p className="service-step-text">
                  Разогретый до комфортной температуры воск наносится тонким слоем 
                  по росту волос. Температура плавления низкая — исключены ожоги.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">03</span>
              <div>
                <h3 className="service-step-title">Удаление</h3>
                <p className="service-step-text">
                  Через несколько секунд воск застывает, образуя плёнку. 
                  Резким движением против роста волос удаляем его вместе с волосками.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">04</span>
              <div>
                <h3 className="service-step-title">Успокоение кожи</h3>
                <p className="service-step-text">
                  Убираем остатки воска маслом, наносим успокаивающий крем 
                  с экстрактом алоэ. Кожа гладкая и увлажнённая.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="service-section" ref={ref2}>
        <div className={`service-section-inner fade-in-up ${isVisible2 ? 'visible' : ''}`}>
          <h2 className="service-h2">Преимущества восковой депиляции</h2>
          <div className="service-benefits-grid">
            <div className="service-benefit-card">
              <span className="service-benefit-icon">⚡</span>
              <h3 className="service-benefit-title">Мгновенный результат</h3>
              <p>Идеально гладкая кожа сразу после процедуры. 
              Не нужно ждать 2 недели, как с лазером.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">💰</span>
              <h3 className="service-benefit-title">Доступная цена</h3>
              <p>Отличное соотношение цены и эффекта. Подходит для любого бюджета.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">📅</span>
              <h3 className="service-benefit-title">Эффект до месяца</h3>
              <p>Волосы отрастают медленнее и тоньше, чем после бритья. 
              Результат держится 3–4 недели.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🌿</span>
              <h3 className="service-benefit-title">Гипоаллергенно</h3>
              <p>ItalWax Premium содержит натуральные масла и смолы. 
              Минимум раздражения, подходит для чувствительной кожи.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">✨</span>
              <h3 className="service-benefit-title">Для любых волос</h3>
              <p>Работает на светлых, тёмных, тонких и жёстких волосах. 
              Лазер светлые не берёт — воск справится.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🎯</span>
              <h3 className="service-benefit-title">Короткие волоски</h3>
              <p>Плёночный воск захватывает волоски от 2–3 мм. 
              Не нужно отращивать до 5 мм, как с обычным воском.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Для каких зон */}
      <section className="service-section service-section--alt">
        <div className="service-section-inner">
          <h2 className="service-h2">Для каких зон подходит</h2>
          <div className="service-text-block">
            <p>
              Восковая депиляция подходит для всех зон тела. Особенно рекомендуем для подготовки 
              к событиям, отпуску или как регулярный метод поддержания гладкости.
            </p>
          </div>
          <div className="service-zones-grid">
            <div className="service-zone-category">
              <h3 className="service-h3">Лицо</h3>
              <ul className="service-zone-list">
                <li>Верхняя губа</li>
                <li>Подбородок</li>
                <li>Брови (коррекция)</li>
              </ul>
            </div>
            <div className="service-zone-category">
              <h3 className="service-h3">Тело</h3>
              <ul className="service-zone-list">
                <li>Подмышки</li>
                <li>Руки</li>
                <li>Ноги</li>
                <li>Спина</li>
                <li>Живот</li>
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
      <section className="service-section">
        <div className="service-section-inner">
          <h2 className="service-h2">Частые вопросы</h2>
          <div className="service-faq">
            <details className="service-faq-item">
              <summary className="service-faq-question">Больно ли?</summary>
              <p className="service-faq-answer">
                Ощущения индивидуальны, но с плёночным воском процедура комфортнее, 
                чем с обычным. Воск плотно обволакивает волоски, не травмируя кожу. 
                Первая процедура может быть чувствительной, но с каждым разом легче.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Какой длины должны быть волосы?</summary>
              <p className="service-faq-answer">
                Оптимально 4–5 мм (примерно неделя после бритья). Плёночный воск ItalWax 
                может захватывать волоски от 2–3 мм, но для лучшего результата рекомендуем 
                чуть отрастить.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Как часто нужно делать?</summary>
              <p className="service-faq-answer">
                Раз в 3–4 недели. С каждой процедурой волосы становятся тоньше, 
                растут медленнее. Некоторым клиенткам достаточно раз в 5–6 недель.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Будет ли раздражение?</summary>
              <p className="service-faq-answer">
                ItalWax Premium содержит успокаивающие компоненты. Лёгкое покраснение может быть 
                в первые 1–2 часа — это нормальная реакция. Мы наносим успокаивающий крем, 
                который минимизирует раздражение.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Можно ли между лазером?</summary>
              <p className="service-faq-answer">
                Да, если вы проходите курс лазерной эпиляции, восковую делать нельзя — 
                она удаляет корень, и лазеру не на что воздействовать. Но после завершения 
                курса лазера воск отлично подходит для поддержания гладкости.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="service-cta">
        <div className="service-cta-inner">
          <h2 className="service-cta-title">Запишитесь на восковую депиляцию</h2>
          <p className="service-cta-text">
            Профессиональные воски, опытные мастера, комфортная атмосфера. 
            Первая процедура со скидкой 10%.
          </p>
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-cta">
            📱 Записаться через Telegram
          </a>
        </div>
      </section>
    </div>
  );
}
