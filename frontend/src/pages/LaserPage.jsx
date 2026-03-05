import { useState } from "react";
import { Link } from "react-router-dom";
import { useScrollAnimation } from "../components/useScrollAnimation.js";

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item${open ? " lp-faq-item--open" : ""}`}>
      <button className="lp-faq-question" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{question}</span>
        <span className="lp-faq-arrow">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="lp-faq-answer">{answer}</div>}
    </div>
  );
}

// ─── Price Table ──────────────────────────────────────────────────────────────
const PRICE_ZONES = {
  women: [
    { zone: "Верхняя губа",              price: "800",   time: "5 мин" },
    { zone: "Подбородок",                price: "900",   time: "5 мин" },
    { zone: "Щёки + скулы",             price: "1 400", time: "10 мин" },
    { zone: "Лицо полностью",            price: "2 800", time: "20 мин" },
    { zone: "Подмышки",                  price: "1 500", time: "10 мин" },
    { zone: "Предплечья",                price: "2 200", time: "15 мин" },
    { zone: "Руки полностью",            price: "3 200", time: "20 мин" },
    { zone: "Голени",                    price: "2 800", time: "20 мин" },
    { zone: "Бёдра",                     price: "3 200", time: "25 мин" },
    { zone: "Ноги полностью",            price: "5 500", time: "40 мин" },
    { zone: "Живот (линия)",             price: "1 200", time: "10 мин" },
    { zone: "Живот полностью",           price: "2 800", time: "20 мин" },
    { zone: "Спина полностью",           price: "4 500", time: "30 мин" },
    { zone: "Бикини классическое",       price: "2 000", time: "15 мин" },
    { zone: "Бикини глубокое",           price: "3 200", time: "20 мин" },
    { zone: "Тотальное бикини",          price: "4 500", time: "30 мин" },
  ],
  men: [
    { zone: "Борода (контур / шея)",     price: "2 000", time: "15 мин" },
    { zone: "Спина полностью",           price: "6 500", time: "45 мин" },
    { zone: "Плечи",                     price: "3 500", time: "25 мин" },
    { zone: "Грудь",                     price: "4 000", time: "30 мин" },
    { zone: "Живот",                     price: "3 200", time: "20 мин" },
    { zone: "Ягодицы",                   price: "3 500", time: "25 мин" },
    { zone: "Ноги полностью",            price: "7 500", time: "55 мин" },
    { zone: "Голени",                    price: "3 800", time: "25 мин" },
    { zone: "Подмышки",                  price: "1 800", time: "10 мин" },
    { zone: "Руки полностью",            price: "4 500", time: "30 мин" },
    { zone: "Интимная зона (мужская)",   price: "3 500", time: "20 мин" },
  ],
};

export function LaserPage({ botUrl }) {
  const [priceTab, setPriceTab] = useState("women");

  const [refHow, visibleHow]           = useScrollAnimation({ threshold: 0.1 });
  const [refBenefits, visibleBenefits] = useScrollAnimation({ threshold: 0.1 });
  const [refZones, visibleZones]       = useScrollAnimation({ threshold: 0.1 });
  const [refPrice, visiblePrice]       = useScrollAnimation({ threshold: 0.1 });
  const [refPrep, visiblePrep]         = useScrollAnimation({ threshold: 0.1 });
  const [refFaq, visibleFaq]           = useScrollAnimation({ threshold: 0.1 });

  const faq = [
    {
      question: "Лазерная эпиляция — это навсегда?",
      answer: "Нет, честный ответ: лазер даёт долгосрочное снижение роста, а не 100% вечное удаление. После курса из 8–10 процедур у большинства клиентов остаётся 10–20% волос — они становятся тонкими, светлыми и редкими. Раз в 1–2 года может потребоваться поддерживающая процедура. Это зависит от гормонального фона, генетики и зоны."
    },
    {
      question: "Больно ли?",
      answer: "Ощущения индивидуальны. Soprano ICE охлаждает кожу до −5°C, что делает процедуру значительно комфортнее, чем воск. Большинство клиентов описывают ощущение как лёгкое тепло или пощипывание. Чувствительные зоны (бикини, верхняя губа) могут быть ощутимее — мы настраиваем параметры индивидуально."
    },
    {
      question: "Сколько сеансов нужно?",
      answer: "В среднем 8–10 процедур с интервалом 4–8 недель (зависит от зоны). Волосы растут в разных фазах — лазер работает только в фазе активного роста (анаген). Поэтому нужно несколько сеансов, чтобы поймать каждый фолликул. После 3–4 процедур результат уже хорошо заметен."
    },
    {
      question: "Можно ли делать летом?",
      answer: "Да, круглый год — при одном условии: не загорать за 2 недели до и 2 недели после процедуры, защищать обработанные зоны SPF 50+. Загоревшая кожа содержит больше меланина — лазер может дать ожог. Если вы только что вернулись из отпуска — подождите 2 недели."
    },
    {
      question: "Как подготовиться к сеансу?",
      answer: "За сутки побрейте обрабатываемую зону бритвой (волоски должны быть 1–2 мм). За 4 недели не делайте воск, шугаринг, эпилятор — только бритьё. За 2 недели не загорайте и не посещайте солярий. В день процедуры придите с чистой кожей без кремов, дезодоранта, декоративной косметики."
    },
    {
      question: "Что делать после процедуры?",
      answer: "В течение 24–48 часов: не париться в бане/сауне, не заниматься спортом с интенсивным потением, не наносить спиртосодержащие средства. В течение 2 недель: SPF 50+ на обработанные зоны на открытом солнце. Для увлажнения подходит алоэ вера или пантенол. Волоски будут выпадать 1–3 недели — это нормально, не выдёргивайте их."
    },
    {
      question: "Есть ли противопоказания?",
      answer: "Абсолютные (процедура невозможна): онкологические заболевания, фотодерматоз, системные заболевания крови, приём фотосенсибилизирующих препаратов (Роаккутан, некоторые антибиотики). Временные (нужно перенести): беременность и лактация, свежий загар (менее 14 дней), активные воспаления на коже, герпес в стадии обострения. На консультации мастер проверит все условия."
    },
    {
      question: "Какой результат после первой процедуры?",
      answer: "Сразу после сеанса кожа чистая и гладкая. Через 7–14 дней обработанные волоски начинают выпадать сами — это нормальный процесс. Новые волосы в этой зоне появятся позже и будут тоньше. С каждой следующей процедурой волос становится меньше."
    },
    {
      question: "Подходит ли лазер для тёмной кожи?",
      answer: "Да — длина волны 1064 нм (Nd:YAG) специально разработана для тёмных фототипов (IV–VI). Soprano ICE имеет все три длины волны, поэтому работает на любом фототипе. Главное — кожа не должна быть загорелой в момент процедуры."
    },
    {
      question: "Работает ли лазер на светлых и рыжих волосах?",
      answer: "Это ограничение лазерной эпиляции: она работает за счёт меланина в волосе. Очень светлые (блонд, рыжие, седые) волосы содержат мало меланина — лазер малоэффективен. В таком случае мы рекомендуем электроэпиляцию — она работает с любым цветом волос."
    },
    {
      question: "Можно ли беременным?",
      answer: "Нет. При беременности и грудном вскармливании лазерная эпиляция противопоказана — это временное ограничение. После окончания лактации можно возобновить процедуры."
    },
    {
      question: "Есть ли скидки на курс?",
      answer: "Да, при оплате курса из 5 процедур сразу действует скидка 10%. Первая консультация и тестовая вспышка — бесплатно. Уточняйте актуальные акции у администратора в Telegram."
    },
  ];

  return (
    <div className="service-page">

      {/* ── Nav ── */}
      <nav className="service-nav">
        <div className="service-nav-inner">
          <Link to="/" className="service-nav-back">← Главная</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="service-hero">
        <div className="service-hero-content">
          <span className="service-eyebrow">Лазерная эпиляция</span>
          <h1 className="service-h1">
            Меньше волос.<br />Надолго. Честно.
          </h1>
          <p className="service-lead">
            Диодный лазер Alma Soprano ICE — долгосрочное снижение роста волос 
            для женщин и мужчин. Подходит для всех фототипов кожи. 
            Параметры подбираются индивидуально.
          </p>
          <div className="service-hero-actions">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              Записаться в Telegram
            </a>
            <span className="service-price-badge">от 800 ₽ за зону</span>
          </div>
          <p className="lp-hero-note">Консультация и тестовая вспышка — бесплатно</p>
        </div>
      </section>

      {/* ── Что это такое ── */}
      <section className="service-section">
        <div className="service-section-inner">
          <span className="lp-tag">Как это работает</span>
          <h2 className="service-h2">Что такое лазерная эпиляция</h2>
          <div className="service-content-grid">
            <div className="service-text-block">
              <p>
                Лазерная эпиляция — метод снижения роста волос, основанный на избирательном 
                фототермолизе. Световой импульс поглощается <strong>меланином</strong> — пигментом 
                волоса — и преобразуется в тепло. Это тепло разрушает волосяной фолликул, 
                не повреждая окружающую кожу.
              </p>
              <p>
                Мы работаем на <strong>Alma Lasers Soprano ICE</strong> — профессиональной 
                системе с тремя длинами волн (755, 808 и 1064 нм) и встроенным 
                контактным охлаждением. Это позволяет работать на всех фототипах кожи 
                и адаптировать процедуру под каждого клиента.
              </p>
              <p>
                <strong>Важно знать:</strong> лазер воздействует только на волосы в фазе 
                активного роста (анаген). Поскольку волосы в разных фазах одновременно, 
                нужен курс из нескольких процедур. Цвет и толщина волос, гормональный фон 
                и зона тела влияют на итоговый результат.
              </p>
            </div>
            <div className="lp-info-block">
              <div className="lp-info-row">
                <span className="lp-info-icon">🔬</span>
                <div>
                  <strong>Метод</strong>
                  <p>Избирательный фототермолиз — тепло разрушает фолликул изнутри</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">🖥️</span>
                <div>
                  <strong>Оборудование</strong>
                  <p>Alma Soprano ICE — три длины волны, сертификация FDA и CE</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">📅</span>
                <div>
                  <strong>Курс</strong>
                  <p>8–10 процедур с интервалом 4–8 недель</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">📉</span>
                <div>
                  <strong>Результат</strong>
                  <p>Снижение роста волос до 80–90% после полного курса</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Как проходит ── */}
      <section className="service-section service-section--alt" ref={refHow}>
        <div className={`service-section-inner fade-in-up ${visibleHow ? "visible" : ""}`}>
          <span className="lp-tag">Процедура</span>
          <h2 className="service-h2">Как проходит сеанс</h2>
          <div className="service-steps">
            <div className="service-step">
              <span className="service-step-number">01</span>
              <div>
                <h3 className="service-step-title">Консультация</h3>
                <p className="service-step-text">
                  Мастер осматривает зону, определяет фототип, уточняет 
                  анамнез и противопоказания. Обсуждаем ожидания, составляем 
                  план курса. На первой процедуре — бесплатная тестовая вспышка.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">02</span>
              <div>
                <h3 className="service-step-title">Подготовка кожи</h3>
                <p className="service-step-text">
                  Очищаем и обезжириваем зону. Наносим охлаждающий гель. 
                  Выдаём защитные очки. Настраиваем параметры лазера 
                  (длину волны, мощность, частоту) под ваш фототип и тип волос.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">03</span>
              <div>
                <h3 className="service-step-title">Обработка</h3>
                <p className="service-step-text">
                  Плавно обрабатываем зону манипулой. Система охлаждения 
                  снижает температуру кожи, обеспечивая комфорт. 
                  Ощущения — от лёгкого тепла до умеренного покалывания 
                  в зависимости от зоны и чувствительности кожи.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">04</span>
              <div>
                <h3 className="service-step-title">Завершение и уход</h3>
                <p className="service-step-text">
                  Наносим успокаивающее средство с пантенолом. 
                  Даём рекомендации по уходу. Через 10–14 дней 
                  обработанные волоски начнут выпадать — это нормальный 
                  результат, не тревожьтесь.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Преимущества ── */}
      <section className="service-section" ref={refBenefits}>
        <div className={`service-section-inner fade-in-up ${visibleBenefits ? "visible" : ""}`}>
          <span className="lp-tag">Почему лазер</span>
          <h2 className="service-h2">Преимущества метода</h2>
          <div className="service-benefits-grid">
            <div className="service-benefit-card">
              <span className="service-benefit-icon">📉</span>
              <h3 className="service-benefit-title">Долгосрочный эффект</h3>
              <p>После полного курса рост волос снижается на 80–90%. Оставшиеся волосы 
              становятся тонкими и светлыми. Раз в 1–2 года — поддерживающая процедура.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">❄️</span>
              <h3 className="service-benefit-title">Комфортная процедура</h3>
              <p>Soprano ICE охлаждает кожу во время работы лазера. Большинство 
              клиентов описывают ощущение как лёгкое тепло. Чувствительные зоны 
              настраиваются отдельно.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">⚡</span>
              <h3 className="service-benefit-title">Быстро</h3>
              <p>Подмышки — 5–7 минут. Голени — 20 минут. Полные ноги — до 40 минут. 
              Можно записаться в обеденный перерыв.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🎨</span>
              <h3 className="service-benefit-title">Любой фототип кожи</h3>
              <p>Три длины волны позволяют работать с фототипами I–VI — 
              от очень светлой до тёмной кожи. Важно: не загорать перед процедурой.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🚫</span>
              <h3 className="service-benefit-title">Без вросших волос</h3>
              <p>Бритьё и воск провоцируют врастание. Лазер устраняет фолликул — 
              вросшие волосы исчезают, кожа становится чище.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🛡️</span>
              <h3 className="service-benefit-title">Проверенная технология</h3>
              <p>Диодный лазер — стандарт в профессиональной эпиляции. 
              Alma Soprano ICE сертифицирован FDA и CE. Более 20 лет клинического применения.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Зоны ── */}
      <section className="service-section service-section--alt" ref={refZones}>
        <div className={`service-section-inner fade-in-up ${visibleZones ? "visible" : ""}`}>
          <span className="lp-tag">Зоны обработки</span>
          <h2 className="service-h2">Для женщин и мужчин</h2>
          <div className="lp-zones-wrapper">
            <div className="lp-zones-col">
              <div className="lp-zones-col-header lp-zones-col-header--women">Женщинам</div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Лицо</div>
                <ul className="service-zone-list">
                  <li>Верхняя губа</li>
                  <li>Подбородок</li>
                  <li>Щёки и скулы</li>
                  <li>Лицо полностью</li>
                  <li>Шея</li>
                </ul>
              </div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Тело</div>
                <ul className="service-zone-list">
                  <li>Подмышки</li>
                  <li>Предплечья / руки полностью</li>
                  <li>Голени / бёдра / ноги полностью</li>
                  <li>Живот (линия или полностью)</li>
                  <li>Спина</li>
                  <li>Ягодицы</li>
                </ul>
              </div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Интимные зоны</div>
                <ul className="service-zone-list">
                  <li>Бикини классическое</li>
                  <li>Бикини глубокое</li>
                  <li>Тотальное бикини</li>
                </ul>
              </div>
            </div>

            <div className="lp-zones-col">
              <div className="lp-zones-col-header lp-zones-col-header--men">Мужчинам</div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Лицо и шея</div>
                <ul className="service-zone-list">
                  <li>Контур бороды / шея</li>
                  <li>Брови (коррекция)</li>
                  <li>Уши</li>
                </ul>
              </div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Тело</div>
                <ul className="service-zone-list">
                  <li>Спина полностью</li>
                  <li>Плечи</li>
                  <li>Грудь</li>
                  <li>Живот</li>
                  <li>Подмышки</li>
                  <li>Руки полностью</li>
                  <li>Ноги (голени / полностью)</li>
                  <li>Ягодицы</li>
                </ul>
              </div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Интимные зоны</div>
                <ul className="service-zone-list">
                  <li>Мошонка</li>
                  <li>Паховая область</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="lp-zones-note">
            <strong>Не нашли нужную зону?</strong> Уточните в Telegram — мы обрабатываем любые участки тела.
          </div>
        </div>
      </section>

      {/* ── Цены ── */}
      <section className="service-section" ref={refPrice}>
        <div className={`service-section-inner fade-in-up ${visiblePrice ? "visible" : ""}`}>
          <span className="lp-tag">Стоимость</span>
          <h2 className="service-h2">Прайс-лист</h2>
          <p className="lp-price-note-top">
            Цена указана за одну процедуру. При оплате курса из 5 сеансов — скидка 10%.
          </p>

          <div className="lp-price-tabs">
            <button
              className={`lp-price-tab${priceTab === "women" ? " lp-price-tab--active" : ""}`}
              onClick={() => setPriceTab("women")}
            >
              Женщины
            </button>
            <button
              className={`lp-price-tab${priceTab === "men" ? " lp-price-tab--active" : ""}`}
              onClick={() => setPriceTab("men")}
            >
              Мужчины
            </button>
          </div>

          <div className="lp-price-table">
            <div className="lp-price-header">
              <span>Зона</span>
              <span>Время</span>
              <span>Цена</span>
            </div>
            {PRICE_ZONES[priceTab].map((row) => (
              <div className="lp-price-row" key={row.zone}>
                <span className="lp-price-zone">{row.zone}</span>
                <span className="lp-price-time">{row.time}</span>
                <span className="lp-price-val">{row.price} ₽</span>
              </div>
            ))}
          </div>

          <div className="lp-price-cta">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              Записаться в Telegram
            </a>
          </div>
        </div>
      </section>

      {/* ── Подготовка и уход ── */}
      <section className="service-section service-section--alt" ref={refPrep}>
        <div className={`service-section-inner fade-in-up ${visiblePrep ? "visible" : ""}`}>
          <span className="lp-tag">Памятка клиента</span>
          <h2 className="service-h2">Подготовка и уход после</h2>
          <div className="lp-prep-grid">
            <div className="lp-prep-card">
              <div className="lp-prep-card-header lp-prep-card-header--before">
                <span className="lp-prep-card-icon">📋</span>
                <h3>До процедуры</h3>
              </div>
              <ul className="lp-prep-list">
                <li><strong>За сутки</strong> — побрить зону бритвой (длина волос 1–2 мм)</li>
                <li><strong>За 4 недели</strong> — не делать воск, шугаринг, не использовать эпилятор</li>
                <li><strong>За 2 недели</strong> — не загорать, не посещать солярий</li>
                <li><strong>В день процедуры</strong> — чистая кожа без кремов, дезодоранта, духов</li>
                <li>Сообщите мастеру о приёме лекарств и хронических заболеваниях</li>
              </ul>
            </div>
            <div className="lp-prep-card">
              <div className="lp-prep-card-header lp-prep-card-header--after">
                <span className="lp-prep-card-icon">✅</span>
                <h3>После процедуры</h3>
              </div>
              <ul className="lp-prep-list">
                <li><strong>24–48 часов</strong> — избегать бани, сауны, интенсивного потоотделения</li>
                <li><strong>2 недели</strong> — SPF 50+ на обработанных зонах при выходе на солнце</li>
                <li>Увлажнять кожу алоэ вера или пантенолом</li>
                <li>Не выдёргивать волоски — они выпадут сами через 1–3 недели</li>
                <li>Не делать воск/шугаринг между процедурами — только бритьё</li>
              </ul>
            </div>
            <div className="lp-prep-card">
              <div className="lp-prep-card-header lp-prep-card-header--contra">
                <span className="lp-prep-card-icon">⚠️</span>
                <h3>Противопоказания</h3>
              </div>
              <ul className="lp-prep-list">
                <li><strong>Абсолютные:</strong> онкология, фотодерматоз, системные заболевания крови</li>
                <li><strong>Абсолютные:</strong> приём Роаккутана, фотосенсибилизирующих препаратов</li>
                <li><strong>Временные:</strong> беременность и лактация</li>
                <li><strong>Временные:</strong> свежий загар (менее 14 дней)</li>
                <li><strong>Временные:</strong> воспаления, ранки, герпес в стадии обострения</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="service-section" ref={refFaq}>
        <div className={`service-section-inner fade-in-up ${visibleFaq ? "visible" : ""}`}>
          <span className="lp-tag">Вопросы и ответы</span>
          <h2 className="service-h2">Частые вопросы</h2>
          <div className="lp-faq">
            {faq.map((item, i) => (
              <FaqItem key={i} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="service-cta">
        <div className="service-cta-inner">
          <h2 className="service-cta-title">Запишитесь на первую процедуру</h2>
          <p className="service-cta-text">
            Консультация и тестовая вспышка — бесплатно. Ответим на вопросы, 
            подберём параметры, составим план курса.
          </p>
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-cta">
            Записаться в Telegram
          </a>
        </div>
      </section>

    </div>
  );
}
