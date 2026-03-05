import { useState } from "react";
import { Link } from "react-router-dom";
import { useScrollAnimation } from "../components/useScrollAnimation.js";

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

const PRICE_ZONES = {
  women: [
    { zone: "Верхняя губа",           price: "400",   time: "5 мин" },
    { zone: "Подбородок",             price: "500",   time: "5 мин" },
    { zone: "Лицо полностью",         price: "1 800", time: "25 мин" },
    { zone: "Подмышки",               price: "700",   time: "10 мин" },
    { zone: "Предплечья",             price: "1 200", time: "20 мин" },
    { zone: "Руки полностью",         price: "1 800", time: "30 мин" },
    { zone: "Голени",                 price: "1 400", time: "25 мин" },
    { zone: "Бёдра",                  price: "1 600", time: "25 мин" },
    { zone: "Ноги полностью",         price: "2 800", time: "45 мин" },
    { zone: "Живот (линия)",          price: "500",   time: "5 мин" },
    { zone: "Живот полностью",        price: "1 400", time: "20 мин" },
    { zone: "Спина полностью",        price: "2 200", time: "35 мин" },
    { zone: "Бикини классическое",    price: "1 200", time: "15 мин" },
    { zone: "Бикини глубокое",        price: "1 800", time: "25 мин" },
    { zone: "Тотальное бикини",       price: "2 400", time: "35 мин" },
    { zone: "Ягодицы",                price: "1 600", time: "20 мин" },
  ],
  men: [
    { zone: "Подмышки",               price: "1 000", time: "15 мин" },
    { zone: "Спина полностью",        price: "3 500", time: "50 мин" },
    { zone: "Плечи",                  price: "2 000", time: "30 мин" },
    { zone: "Грудь",                  price: "2 200", time: "35 мин" },
    { zone: "Живот",                  price: "1 800", time: "25 мин" },
    { zone: "Ягодицы",                price: "2 000", time: "30 мин" },
    { zone: "Голени",                 price: "2 000", time: "30 мин" },
    { zone: "Ноги полностью",         price: "3 800", time: "60 мин" },
    { zone: "Руки полностью",         price: "2 400", time: "35 мин" },
    { zone: "Шея / контур бороды",    price: "1 000", time: "15 мин" },
    { zone: "Интимная зона (мужская)", price: "2 000", time: "30 мин" },
  ],
};

export function WaxPage({ botUrl }) {
  const [priceTab, setPriceTab] = useState("women");

  const [refHow, visibleHow]           = useScrollAnimation({ threshold: 0.1 });
  const [refBenefits, visibleBenefits] = useScrollAnimation({ threshold: 0.1 });
  const [refZones, visibleZones]       = useScrollAnimation({ threshold: 0.1 });
  const [refPrice, visiblePrice]       = useScrollAnimation({ threshold: 0.1 });
  const [refPrep, visiblePrep]         = useScrollAnimation({ threshold: 0.1 });
  const [refFaq, visibleFaq]           = useScrollAnimation({ threshold: 0.1 });

  const faq = [
    {
      question: "Больно ли делать восковую депиляцию?",
      answer: "Ощущения зависят от зоны и индивидуального порога чувствительности. Подмышки и ноги переносятся легко. Бикини и верхняя губа — чувствительнее. Плёночный воск ItalWax захватывает кожу мягче, чем полосковый, и снимается резче — это снижает дискомфорт. С каждой процедурой становится легче, так как волосы становятся тоньше.",
    },
    {
      question: "Какой должна быть длина волос?",
      answer: "Оптимально 4–6 мм — примерно 1–1,5 недели после бритья. Плёночный воск ItalWax захватывает волоски от 2–3 мм, но для чистого результата лучше немного отрастить. Слишком длинные волосы (более 1 см) лучше подстричь перед процедурой.",
    },
    {
      question: "Как часто нужно делать процедуру?",
      answer: "Раз в 3–5 недель. Это зависит от скорости роста ваших волос и зоны. Со временем волосы становятся тоньше и редеют — многим клиентам хватает раза в 5–6 недель. Лучше приходить до того, как волоски успеют отрасти до неудобной длины.",
    },
    {
      question: "Можно ли делать во время месячных?",
      answer: "Технически можно, но в критические дни и за пару дней до них чувствительность кожи повышена. Если процедура терпимая в обычное время — можно прийти. Если вы чувствительны — лучше перенести на другое время цикла.",
    },
    {
      question: "Будет ли раздражение после?",
      answer: "Лёгкое покраснение в первые 2–4 часа — нормальная реакция. Мы наносим успокаивающий крем с алоэ сразу после процедуры. Если кожа склонна к раздражению, используйте дома средства с пантенолом. Главное — не трогать зону руками и не носить синтетику в первые 24 часа.",
    },
    {
      question: "Подходит ли воск для светлых волос?",
      answer: "Да, это одно из главных преимуществ восковой депиляции перед лазером. Воск работает механически, без привязки к пигменту волоса — он захватывает любые волосы вне зависимости от цвета.",
    },
    {
      question: "Можно ли делать во время беременности?",
      answer: "Восковая депиляция не запрещена при беременности — в отличие от лазера или электро. Однако чувствительность кожи в этот период повышена. Рекомендуем проконсультироваться с акушером-гинекологом и обязательно сообщить мастеру о беременности.",
    },
    {
      question: "Не будет ли вросших волос?",
      answer: "Вросшие волосы после воска — частая проблема, особенно у людей с густыми и жёсткими волосами. Чтобы снизить риск: скрабируйте кожу раз в неделю через 3–4 дня после процедуры, увлажняйте кожу, не носите тесное бельё. Плёночный воск меньше травмирует кожу и снижает риск врастания по сравнению с обычным.",
    },
    {
      question: "Как подготовиться к процедуре?",
      answer: "Волосы 4–6 мм. За сутки не наносить кремы и масла на зону. Принять душ перед процедурой. Не загорать за неделю до (особенно зоны бикини и спина). Если планируете зону бикини — лучше не приходить в критические дни: чувствительность выше.",
    },
    {
      question: "Как ухаживать за кожей после?",
      answer: "В первые 24 часа: не посещать баню, сауну, бассейн, не заниматься спортом с сильным потоотделением. Не тереть зону мочалкой. Через 2–3 дня начните использовать скраб 1–2 раза в неделю — это профилактика вросших волос. Увлажняйте кожу ежедневно.",
    },
    {
      question: "Чем восковая депиляция отличается от шугаринга?",
      answer: "Воск: наносится по росту волос, снимается против роста, работает на коротких волосках от 2–3 мм. Плёночный воск не оставляет полосок. Шугаринг: паста на водной основе, снимается по росту, считается более щадящим, но требует волосков от 4–5 мм. Мы работаем на воске ItalWax — это профессиональный стандарт.",
    },
    {
      question: "Есть ли противопоказания?",
      answer: "Временные: свежие порезы и ссадины на коже, солнечный ожог, сильное раздражение или воспаление в зоне обработки, варикоз (для ног — уточните у мастера). Абсолютные: активные кожные заболевания в зоне обработки (псориаз, экзема в острой стадии). При сомнениях — проконсультируйтесь с дерматологом.",
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
          <span className="service-eyebrow">Восковая депиляция</span>
          <h1 className="service-h1">
            Гладко здесь и сейчас.<br />Без откладывания.
          </h1>
          <p className="service-lead">
            Профессиональные плёночные воски ItalWax Premium — мгновенный результат 
            для женщин и мужчин. Подходит для светлых волос. Работает без привязки к пигменту.
          </p>
          <div className="service-hero-actions">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              Записаться в Telegram
            </a>
            <span className="service-price-badge">от 400 ₽ за зону</span>
          </div>
          <p className="lp-hero-note">Результат сразу после процедуры · Эффект 3–5 недель</p>
        </div>
      </section>

      {/* ── Что это такое ── */}
      <section className="service-section">
        <div className="service-section-inner">
          <span className="lp-tag">Как это работает</span>
          <h2 className="service-h2">Что такое восковая депиляция</h2>
          <div className="service-content-grid">
            <div className="service-text-block">
              <p>
                Восковая депиляция — механическое удаление волос с корнем при помощи 
                разогретого воска. Мы используем <strong>плёночный воск ItalWax Premium</strong> — 
                профессиональный состав с натуральными смолами и маслами, который застывает 
                в эластичную плёнку и снимается без бумажных полосок.
              </p>
              <p>
                В отличие от классического воска, плёночный вариант плотнее обволакивает 
                каждый волосок, не прилипает к коже и захватывает волосы длиной от 2–3 мм. 
                Меньше дискомфорта, меньше раздражения, чище результат.
              </p>
              <p>
                <strong>Главное преимущество перед лазером:</strong> воск работает 
                на волосах любого цвета — светлых, рыжих, седых. Результат виден сразу, 
                а не через 2 недели.
              </p>
            </div>
            <div className="lp-info-block">
              <div className="lp-info-row">
                <span className="lp-info-icon">🌿</span>
                <div>
                  <strong>Материал</strong>
                  <p>ItalWax Premium — плёночный воск с натуральными смолами и маслами</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">✂️</span>
                <div>
                  <strong>Длина волос</strong>
                  <p>От 2–3 мм (плёночный воск). Оптимально 4–6 мм</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">📅</span>
                <div>
                  <strong>Периодичность</strong>
                  <p>Раз в 3–5 недель. Со временем волосы становятся тоньше</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">🎯</span>
                <div>
                  <strong>Результат</strong>
                  <p>Идеально гладкая кожа сразу после процедуры</p>
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
                <h3 className="service-step-title">Подготовка кожи</h3>
                <p className="service-step-text">
                  Очищаем зону лосьоном, наносим тальк — он защищает кожу 
                  от прилипания воска и обеспечивает лучший захват волосков. 
                  При необходимости подстригаем слишком длинные волоски.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">02</span>
              <div>
                <h3 className="service-step-title">Нанесение воска</h3>
                <p className="service-step-text">
                  Разогретый до комфортной температуры плёночный воск наносится 
                  шпателем тонким слоем по направлению роста волос. 
                  Температура подобрана так, чтобы исключить ожог — воск тёплый, 
                  не горячий.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">03</span>
              <div>
                <h3 className="service-step-title">Застывание и удаление</h3>
                <p className="service-step-text">
                  Воск застывает за несколько секунд, плотно обволакивая каждый 
                  волосок. Мастер снимает его резким движением против роста волос 
                  вместе с корнями. Кожа остаётся чистой.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">04</span>
              <div>
                <h3 className="service-step-title">Уход после</h3>
                <p className="service-step-text">
                  Удаляем остатки воска специальным маслом. Наносим 
                  успокаивающий крем с алоэ вера и пантенолом. 
                  Даём рекомендации по домашнему уходу.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Преимущества ── */}
      <section className="service-section" ref={refBenefits}>
        <div className={`service-section-inner fade-in-up ${visibleBenefits ? "visible" : ""}`}>
          <span className="lp-tag">Почему воск</span>
          <h2 className="service-h2">Преимущества метода</h2>
          <div className="service-benefits-grid">
            <div className="service-benefit-card">
              <span className="service-benefit-icon">⚡</span>
              <h3 className="service-benefit-title">Мгновенный результат</h3>
              <p>Гладкая кожа сразу после процедуры. Не нужно ждать 2 недели, 
              как при лазере. Идеально перед отпуском или событием.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🎨</span>
              <h3 className="service-benefit-title">Любой цвет волос</h3>
              <p>Воск работает механически — без привязки к пигменту. 
              Светлые, рыжие, седые волосы удаляются так же хорошо, как тёмные.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">💰</span>
              <h3 className="service-benefit-title">Доступная цена</h3>
              <p>Одна из самых доступных процедур депиляции. 
              Хорошее соотношение цены и эффекта без долгосрочных вложений в курс.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">📅</span>
              <h3 className="service-benefit-title">Эффект до 5 недель</h3>
              <p>Волосы удаляются с корнем и отрастают медленнее, чем после бритья. 
              С регулярными процедурами они становятся тоньше.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🌿</span>
              <h3 className="service-benefit-title">Щадящий состав</h3>
              <p>ItalWax Premium содержит натуральные масла и смолы, 
              минимизирует раздражение. Подходит для чувствительной кожи.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">✂️</span>
              <h3 className="service-benefit-title">Короткие волоски</h3>
              <p>Плёночный воск захватывает волосы от 2–3 мм — 
              не нужно отращивать до 5 мм, как с обычным воском.</p>
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
                  <li>Щёки</li>
                  <li>Лицо полностью</li>
                  <li>Брови (коррекция формы)</li>
                </ul>
              </div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Тело</div>
                <ul className="service-zone-list">
                  <li>Подмышки</li>
                  <li>Руки (предплечья / полностью)</li>
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
                  <li>Шея / контур бороды</li>
                  <li>Брови (коррекция)</li>
                  <li>Уши</li>
                </ul>
              </div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Тело</div>
                <ul className="service-zone-list">
                  <li>Спина и плечи</li>
                  <li>Грудь и живот</li>
                  <li>Подмышки</li>
                  <li>Руки полностью</li>
                  <li>Ноги (голени / полностью)</li>
                  <li>Ягодицы</li>
                </ul>
              </div>
              <div className="lp-zones-group">
                <div className="lp-zones-group-label">Интимные зоны</div>
                <ul className="service-zone-list">
                  <li>Паховая область</li>
                  <li>Интимная зона мужская</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="lp-zones-note">
            <strong>Не нашли нужную зону?</strong> Напишите в Telegram — уточним возможность и стоимость.
          </div>
        </div>
      </section>

      {/* ── Цены ── */}
      <section className="service-section" ref={refPrice}>
        <div className={`service-section-inner fade-in-up ${visiblePrice ? "visible" : ""}`}>
          <span className="lp-tag">Стоимость</span>
          <h2 className="service-h2">Прайс-лист</h2>
          <p className="lp-price-note-top">
            Цена за одну процедуру. При регулярных визитах — карта постоянного клиента со скидкой 10%.
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
                <li><strong>Длина волос</strong> — 4–6 мм (≈1,5 нед. после бритья). Короче — плёночный воск берёт от 2–3 мм</li>
                <li><strong>За сутки</strong> — не наносить жирные кремы и масла на зону</li>
                <li><strong>В день процедуры</strong> — принять душ, кожа чистая и сухая</li>
                <li>Сообщите о варикозе на ногах, кожных заболеваниях, беременности</li>
                <li>Зону бикини лучше не делать в критические дни — чувствительность выше</li>
              </ul>
            </div>
            <div className="lp-prep-card">
              <div className="lp-prep-card-header lp-prep-card-header--after">
                <span className="lp-prep-card-icon">✅</span>
                <h3>После процедуры</h3>
              </div>
              <ul className="lp-prep-list">
                <li><strong>24 часа</strong> — не посещать баню, сауну, бассейн</li>
                <li><strong>24 часа</strong> — избегать интенсивного потоотделения (спорт)</li>
                <li>Не тереть зону мочалкой в первые сутки</li>
                <li>Увлажнять кожу пантенолом или кремом с алоэ</li>
                <li><strong>Через 3–4 дня</strong> начать мягкий скраб 1–2 раза в неделю — профилактика вросших волос</li>
              </ul>
            </div>
            <div className="lp-prep-card">
              <div className="lp-prep-card-header lp-prep-card-header--contra">
                <span className="lp-prep-card-icon">⚠️</span>
                <h3>Противопоказания</h3>
              </div>
              <ul className="lp-prep-list">
                <li><strong>Временные:</strong> ссадины, порезы, раздражение в зоне обработки</li>
                <li><strong>Временные:</strong> солнечный ожог</li>
                <li><strong>Временные:</strong> активные высыпания (прыщи, фурункулы) в зоне</li>
                <li><strong>С осторожностью:</strong> варикоз — только при отсутствии воспаления</li>
                <li><strong>Абсолютные:</strong> псориаз, экзема, дерматит в острой стадии</li>
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
          <h2 className="service-cta-title">Запишитесь на восковую депиляцию</h2>
          <p className="service-cta-text">
            Профессиональный воск, аккуратная работа, честные цены. 
            Запись через Telegram — быстро и без звонков.
          </p>
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-cta">
            Записаться в Telegram
          </a>
        </div>
      </section>

    </div>
  );
}
