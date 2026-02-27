import { Link } from "react-router-dom";
import { useScrollAnimation } from "../components/useScrollAnimation.js";

export function ElectroPage({ botUrl }) {
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
          <span className="service-eyebrow">⚡ Электроэпиляция</span>
          <h1 className="service-h1">Индивидуальный подход к каждому волоску</h1>
          <p className="service-lead">
            Профессиональная система Apilus xCell Pro для перманентного удаления любых волос — 
            светлых, седых, рыжих и пушковых. Единственный метод, одобренный FDA как постоянное удаление.
          </p>
          <div className="service-hero-actions">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              📱 Записаться онлайн
            </a>
            <span className="service-price-badge">от 1800 ₽</span>
          </div>
        </div>
      </section>

      {/* Что это */}
      <section className="service-section" ref={ref1}>
        <div className={`service-section-inner fade-in-up ${isVisible1 ? 'visible' : ''}`}>
          <h2 className="service-h2">Что такое электроэпиляция</h2>
          <div className="service-content-grid">
            <div className="service-text-block">
              <p>
                Электроэпиляция — единственный метод, признанный FDA как способ перманентного 
                (постоянного) удаления волос. Тончайшая игла-электрод вводится в каждый волосяной 
                фолликул, слабый электрический разряд разрушает корень навсегда.
              </p>
              <p>
                Мы используем <strong>Apilus xCell Pro</strong> — профессиональную систему с частотой 
                27,12 МГц, которая обеспечивает максимальную эффективность при минимальном дискомфорте. 
                Это лучший выбор для тех, кому не подходит лазер.
              </p>
            </div>
            <div className="service-highlight-box">
              <h3 className="service-h3">Принцип работы</h3>
              <ul className="service-list">
                <li>Стерильная игла вводится в фолликул</li>
                <li>Высокочастотный ток разрушает корень</li>
                <li>Волос удаляется пинцетом</li>
                <li>Фолликул больше не производит волос</li>
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
                <h3 className="service-step-title">Консультация</h3>
                <p className="service-step-text">
                  Оцениваем зону, тип волос и кожи. Электроэпиляция идеальна для светлых, 
                  седых, рыжих волос и малых зон (верхняя губа, подбородок, брови).
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">02</span>
              <div>
                <h3 className="service-step-title">Подготовка</h3>
                <p className="service-step-text">
                  Обрабатываем кожу антисептиком. При необходимости наносим обезболивающий крем 
                  для чувствительных зон (действует через 30 минут).
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">03</span>
              <div>
                <h3 className="service-step-title">Обработка</h3>
                <p className="service-step-text">
                  Работаем с каждым волоском индивидуально: вводим иглу, подаём импульс, 
                  удаляем волос. Процедура требует времени, но результат — навсегда.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">04</span>
              <div>
                <h3 className="service-step-title">Завершение</h3>
                <p className="service-step-text">
                  Наносим успокаивающее средство, даём рекомендации по уходу. 
                  Лёгкое покраснение проходит за несколько часов.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Преимущества */}
      <section className="service-section" ref={ref2}>
        <div className={`service-section-inner fade-in-up ${isVisible2 ? 'visible' : ''}`}>
          <h2 className="service-h2">Преимущества электроэпиляции</h2>
          <div className="service-benefits-grid">
            <div className="service-benefit-card">
              <span className="service-benefit-icon">♾️</span>
              <h3 className="service-benefit-title">Удаление навсегда</h3>
              <p>Разрушенный фолликул больше не производит волос. 
              Единственный метод с FDA-статусом "permanent hair removal".</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🎨</span>
              <h3 className="service-benefit-title">Для любого цвета волос</h3>
              <p>Работает на светлых, седых, рыжих, пушковых волосах. 
              Лазер их не берёт — электро справится.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🌈</span>
              <h3 className="service-benefit-title">Для любой кожи</h3>
              <p>Безопасно даже для очень светлой или очень тёмной кожи. 
              Нет ограничений по фототипу.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🎯</span>
              <h3 className="service-benefit-title">Точечная работа</h3>
              <p>Идеально для малых зон: верхняя губа (15-20 мин), 
              подбородок (20-30 мин), коррекция бровей.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">✨</span>
              <h3 className="service-benefit-title">Универсальность</h3>
              <p>Единственный метод для финальной доработки после лазера. 
              Убирает оставшиеся светлые волоски.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🔬</span>
              <h3 className="service-benefit-title">Проверено временем</h3>
              <p>Метод используется более 140 лет. Доказанная эффективность, 
              одобрено медицинским сообществом.</p>
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
              Электроэпиляция рекомендуется для небольших зон и финальной доработки после лазера. 
              Идеальна для удаления светлых, седых и гормональных волосков.
            </p>
          </div>
          <div className="service-zones-grid">
            <div className="service-zone-category">
              <h3 className="service-h3">Лицо (оптимально)</h3>
              <ul className="service-zone-list">
                <li>Верхняя губа</li>
                <li>Подбородок</li>
                <li>Щёки</li>
                <li>Брови (коррекция формы)</li>
                <li>Переносица</li>
              </ul>
            </div>
            <div className="service-zone-category">
              <h3 className="service-h3">Тело (малые зоны)</h3>
              <ul className="service-zone-list">
                <li>Ареолы (вокруг сосков)</li>
                <li>Белая линия живота</li>
                <li>Пальцы рук и ног</li>
                <li>Единичные волоски</li>
              </ul>
            </div>
            <div className="service-zone-category">
              <h3 className="service-h3">Финальная доработка</h3>
              <ul className="service-zone-list">
                <li>После курса лазера</li>
                <li>Светлые волоски</li>
                <li>Седые волоски</li>
                <li>Гормональные волоски</li>
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
              <summary className="service-faq-question">Больно ли делать электроэпиляцию?</summary>
              <p className="service-faq-answer">
                Ощущения индивидуальны. Apilus xCell Pro с частотой 27,12 МГц даёт меньше 
                дискомфорта, чем старые аппараты. Чувствуется лёгкое покалывание. 
                Для чувствительных зон используем обезболивающий крем.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Сколько нужно процедур?</summary>
              <p className="service-faq-answer">
                Зависит от зоны и количества волос. Верхняя губа — 6-10 сеансов, 
                подбородок — 10-15 сеансов. Волосы растут циклами, нужно "поймать" 
                все в активной фазе. Интервал 2-4 недели.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Почему так долго?</summary>
              <p className="service-faq-answer">
                Каждый волосок обрабатывается индивидуально — это требует времени. 
                Зато результат навсегда. Верхняя губа — 15-30 мин, подбородок — 30-60 мин за сеанс.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Можно ли после лазера?</summary>
              <p className="service-faq-answer">
                Да, электроэпиляция — идеальное решение для финальной доработки после курса лазера. 
                Убирает оставшиеся светлые, седые или пушковые волоски, которые лазер не берёт.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Чем отличается от лазера?</summary>
              <p className="service-faq-answer">
                Лазер: быстрее, для больших зон, только тёмные волосы. 
                Электро: дольше, для малых зон, любой цвет волос, гарантия навсегда. 
                Часто используют вместе: лазер для основной массы, электро для финализации.
              </p>
            </details>
            <details className="service-faq-item">
              <summary className="service-faq-question">Какой длины должны быть волосы?</summary>
              <p className="service-faq-answer">
                2-3 мм (2-3 дня после бритья). Слишком длинные неудобно обрабатывать, 
                слишком короткие сложно захватить пинцетом.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="service-cta">
        <div className="service-cta-inner">
          <h2 className="service-cta-title">Запишитесь на электроэпиляцию</h2>
          <p className="service-cta-text">
            Профессиональный аппарат Apilus, опытные мастера, стерильные расходники. 
            Консультация бесплатная — подберём оптимальную стратегию.
          </p>
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-cta">
            📱 Записаться через Telegram
          </a>
        </div>
      </section>
    </div>
  );
}
