import { useState } from "react";
import { Link } from "react-router-dom";
import { useScrollAnimation } from "../components/useScrollAnimation.js";
import { useCatalog } from "../hooks/useCatalog.js";
import { buildTelegramLink } from "../api/telegram.js";

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

/** Collect unique items from "time" group across genders for the price grid */
function getTimePackageItems(sections) {
  if (!sections || typeof sections !== "object") return [];
  const byId = new Map();
  for (const genderSections of Object.values(sections)) {
    if (!genderSections?.time?.items?.length) continue;
    for (const item of genderSections.time.items) {
      if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort((a, b) => (a.durationMin ?? 0) - (b.durationMin ?? 0));
}

/** All non-time groups as { groupKey, title, items } for zone/info sections */
function getZoneAndInfoGroups(sections) {
  if (!sections || typeof sections !== "object") return [];
  const seen = new Set();
  const result = [];
  for (const genderSections of Object.values(sections)) {
    if (!genderSections || typeof genderSections !== "object") continue;
    for (const [groupKey, group] of Object.entries(genderSections)) {
      if (groupKey === "time" || !group?.items?.length) continue;
      if (seen.has(groupKey)) continue;
      seen.add(groupKey);
      result.push({ groupKey, title: group.title, items: group.items });
    }
  }
  return result;
}

export function ElectroPage({ botUrl }) {
  const { data: catalogData, loading: catalogLoading, error: catalogError } = useCatalog("electro");
  const [refHow, visibleHow]           = useScrollAnimation({ threshold: 0.1 });
  const [refBenefits, visibleBenefits] = useScrollAnimation({ threshold: 0.1 });
  const [refZones, visibleZones]       = useScrollAnimation({ threshold: 0.1 });
  const [refPrice, visiblePrice]       = useScrollAnimation({ threshold: 0.1 });
  const [refPrep, visiblePrep]         = useScrollAnimation({ threshold: 0.1 });
  const [refFaq, visibleFaq]           = useScrollAnimation({ threshold: 0.1 });

  const faq = [
    {
      question: "Электроэпиляция — это действительно навсегда?",
      answer: "Электроэпиляция — единственный метод, признанный FDA как permanent hair removal (постоянное удаление волос). Если фолликул разрушен корректно, волос из него больше не вырастет. Оговорка: гормональные изменения (беременность, эндокринные заболевания) могут активировать «спящие» фолликулы. Поэтому у некоторых клиентов через годы появляются единичные новые волоски — это не рецидив, а новый рост.",
    },
    {
      question: "Больно ли?",
      answer: "Ощущения индивидуальны и зависят от зоны и чувствительности кожи. Apilus xCell Pro работает на частоте 27,12 МГц — это минимальный дискомфорт по сравнению со старыми аппаратами. Большинство клиентов описывают ощущение как лёгкое покалывание или жжение в момент импульса. Для чувствительных зон (верхняя губа, бикини) применяем анестезирующий крем за 30–40 минут до сеанса.",
    },
    {
      question: "Сколько сеансов нужно?",
      answer: "Зависит от зоны и количества волос. Верхняя губа — 8–12 сеансов, подбородок — 10–15 сеансов. Интервал между сеансами — 2–4 недели (нужно дать коже восстановиться и дождаться волосков в фазе роста). Это небыстро, но каждый обработанный волосок не вернётся — вы платите один раз.",
    },
    {
      question: "Чем электроэпиляция отличается от лазера?",
      answer: "Лазер: быстрый (зона за минуты), хорошо работает на тёмных волосах, даёт долгосрочное снижение роста на 80–90%. Не работает на светлых, рыжих, седых волосах. Электро: медленнее (волосок за волоском), работает на любом цвете волос, даёт перманентный результат по каждому обработанному фолликулу. Часто используют вместе: лазер убирает основную массу тёмных волос, электро доводит оставшиеся светлые до финала.",
    },
    {
      question: "Почему у меня не взяли лазером, а рекомендуют электро?",
      answer: "Лазер работает только на волосах с достаточным количеством меланина — пигмента, который поглощает световую энергию. Светлые (блонд), рыжие, седые и пушковые волосы содержат мало меланина — лазерный импульс проходит мимо фолликула. Электроэпиляция воздействует напрямую на фолликул электрическим током — цвет волоса значения не имеет.",
    },
    {
      question: "Какой длины должны быть волосы?",
      answer: "2–4 мм — достаточно, чтобы мастер ввёл иглу по направлению волоса и захватил пинцетом после импульса. Не нужно специально отращивать. Не брейте зону за 3–5 дней до процедуры.",
    },
    {
      question: "Можно ли делать электроэпиляцию при беременности?",
      answer: "Нет — электроэпиляция противопоказана при беременности. Ток проходит через тело, и хотя воздействие локальное и незначительное, риск не оправдан. После родов и окончания грудного вскармливания можно возобновить процедуры.",
    },
    {
      question: "Останутся ли следы на коже?",
      answer: "После каждой процедуры нормально появление лёгкого покраснения и небольших корочек в местах обработки — они проходят за 2–7 дней. При соблюдении рекомендаций по уходу рубцов и пятен не остаётся. Apilus с высокочастотным током минимизирует тепловое воздействие на окружающую кожу.",
    },
    {
      question: "Иглы стерильные?",
      answer: "Да, мы используем одноразовые стерильные иглы — вскрываются при вас. После процедуры утилизируются. Это стандарт безопасности, который мы соблюдаем без исключений.",
    },
    {
      question: "Как подготовиться?",
      answer: "Не брейте зону 3–5 дней до процедуры — нужны волоски длиной 2–4 мм. Кожа должна быть чистой, без кремов. Если планируете анестезирующий крем — нанесите за 40–60 минут до визита (уточните у мастера, какой крем купить). Не загорайте за неделю до процедуры.",
    },
    {
      question: "Есть ли противопоказания?",
      answer: "Абсолютные: онкологические заболевания, кардиостимулятор, беременность, эпилепсия, острые воспалительные заболевания кожи в зоне обработки. Временные: активный герпес в области обработки, кожные инфекции в зоне. На консультации мастер уточняет все условия.",
    },
    {
      question: "Можно ли совмещать с лазером?",
      answer: "Да, и это популярная стратегия. Сначала делают курс лазерной эпиляции — убирают 80–90% тёмных волос быстро и по доступной цене. Затем электроэпиляцией дорабатывают оставшиеся светлые, тонкие или единичные волоски. Суммарный результат — чистая кожа на долгий срок.",
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
          <span className="service-eyebrow">Электроэпиляция</span>
          <h1 className="service-h1">
            Волосок за волоском.<br />Навсегда.
          </h1>
          <p className="service-lead">
            Единственный метод, признанный FDA как постоянное удаление волос. 
            Работает на любом цвете волос — светлых, рыжих, седых, пушковых. 
            Apilus xCell Pro — минимальный дискомфорт, максимальный результат.
          </p>
          <div className="service-hero-actions">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              Записаться в Telegram
            </a>
            <span className="service-price-badge">от 900 ₽ / 15 мин</span>
          </div>
          <p className="lp-hero-note">Консультация бесплатно · Одноразовые стерильные иглы</p>
        </div>
      </section>

      {/* ── Что это такое ── */}
      <section className="service-section">
        <div className="service-section-inner">
          <span className="lp-tag">Как это работает</span>
          <h2 className="service-h2">Что такое электроэпиляция</h2>
          <div className="service-content-grid">
            <div className="service-text-block">
              <p>
                Электроэпиляция — метод, при котором тончайшая игла-электрод 
                вводится в волосяной канал и подаёт электрический импульс прямо в фолликул. 
                Ток разрушает зону роста волоса. Обработанный фолликул перестаёт 
                производить волос навсегда.
              </p>
              <p>
                Мы работаем на <strong>Apilus xCell Pro</strong> — профессиональной системе 
                с частотой 27,12 МГц. Высокая частота означает: тепловое воздействие 
                сосредоточено точечно в фолликуле, не повреждая окружающую кожу, 
                и дискомфорт минимален по сравнению со старыми аппаратами.
              </p>
              <p>
                <strong>Кому особенно подходит:</strong> тем, кого лазер не берёт — 
                светлые, рыжие, седые волосы. Тем, кто хочет финально завершить 
                курс лазерной эпиляции. Тем, кому нужны точечные малые зоны: 
                верхняя губа, подбородок, коррекция бровей.
              </p>
            </div>
            <div className="lp-info-block">
              <div className="lp-info-row">
                <span className="lp-info-icon">⚡</span>
                <div>
                  <strong>Метод</strong>
                  <p>Высокочастотный ток разрушает фолликул изнутри — навсегда</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">🖥️</span>
                <div>
                  <strong>Оборудование</strong>
                  <p>Apilus xCell Pro — 27,12 МГц, одобрен Health Canada</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">💉</span>
                <div>
                  <strong>Безопасность</strong>
                  <p>Одноразовые стерильные иглы. Вскрываются при клиенте</p>
                </div>
              </div>
              <div className="lp-info-row">
                <span className="lp-info-icon">🏆</span>
                <div>
                  <strong>Статус</strong>
                  <p>FDA: единственный признанный метод permanent hair removal</p>
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
                <h3 className="service-step-title">Консультация и осмотр</h3>
                <p className="service-step-text">
                  Оцениваем зону, тип волос, уточняем цель — финализация после лазера 
                  или полный курс. Объясняем, сколько сеансов потребуется и 
                  какой результат реалистичен именно в вашем случае.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">02</span>
              <div>
                <h3 className="service-step-title">Подготовка</h3>
                <p className="service-step-text">
                  Обрабатываем кожу антисептиком. При необходимости — 
                  анестезирующий крем за 40 минут. Вскрываем стерильную одноразовую 
                  иглу при вас. Настраиваем параметры под тип волоса и зону.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">03</span>
              <div>
                <h3 className="service-step-title">Обработка</h3>
                <p className="service-step-text">
                  Тончайшая игла вводится в волосяной канал — без прокола кожи, 
                  по естественному каналу волоса. Кратковременный импульс тока. 
                  Волос удаляется пинцетом без усилия — это признак правильного 
                  разрушения фолликула. Работаем волосок за волоском.
                </p>
              </div>
            </div>
            <div className="service-step">
              <span className="service-step-number">04</span>
              <div>
                <h3 className="service-step-title">Уход после</h3>
                <p className="service-step-text">
                  Наносим успокаивающее и антисептическое средство. 
                  Лёгкое покраснение и небольшие корочки в местах обработки — 
                  нормальная реакция, проходит за 2–7 дней при правильном уходе.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Преимущества ── */}
      <section className="service-section" ref={refBenefits}>
        <div className={`service-section-inner fade-in-up ${visibleBenefits ? "visible" : ""}`}>
          <span className="lp-tag">Почему электро</span>
          <h2 className="service-h2">Преимущества метода</h2>
          <div className="service-benefits-grid">
            <div className="service-benefit-card">
              <span className="service-benefit-icon">♾️</span>
              <h3 className="service-benefit-title">Перманентный результат</h3>
              <p>Разрушенный фолликул не восстанавливается. Каждый обработанный 
              волосок — навсегда. Единственный метод с таким статусом от FDA.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🎨</span>
              <h3 className="service-benefit-title">Любой цвет волос</h3>
              <p>Светлые, рыжие, седые, пушковые — без ограничений. 
              Именно здесь электро выигрывает у лазера: цвет волоса не имеет значения.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🔬</span>
              <h3 className="service-benefit-title">Точечная работа</h3>
              <p>Идеален для малых зон и единичных волосков. Верхняя губа, 
              подбородок, коррекция бровей, пальцы — там, где лазер избыточен.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🤝</span>
              <h3 className="service-benefit-title">Финализация после лазера</h3>
              <p>Лазер убирает 80–90% тёмных волос. Электро дорабатывает остальное — 
              светлые и единичные волоски, которые лазер не берёт.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">🌈</span>
              <h3 className="service-benefit-title">Любой фототип кожи</h3>
              <p>Нет ограничений по цвету кожи. Одинаково работает на светлой 
              и тёмной коже — без риска ожога от лазерного импульса.</p>
            </div>
            <div className="service-benefit-card">
              <span className="service-benefit-icon">📜</span>
              <h3 className="service-benefit-title">Проверено временем</h3>
              <p>Метод используется с 1875 года. Более 140 лет клинической практики. 
              Признан медицинским сообществом по всему миру.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Зоны ── */}
      <section className="service-section service-section--alt" ref={refZones}>
        <div className={`service-section-inner fade-in-up ${visibleZones ? "visible" : ""}`}>
          <span className="lp-tag">Зоны и сроки</span>
          <h2 className="service-h2">Для каких зон подходит</h2>
          <p className="lp-section-intro">
            Электроэпиляция оптимальна для небольших зон и финальной доработки. 
            Ниже — ориентировочное время сеанса и количество процедур для каждой зоны. 
            Точные цифры зависят от плотности волос и индивидуальных особенностей.
          </p>
          {catalogLoading && <p className="lp-catalog-loading">Загрузка…</p>}
          {catalogError && <p className="lp-catalog-error">Не удалось загрузить данные. {catalogError}</p>}
          {!catalogLoading && !catalogError && getZoneAndInfoGroups(catalogData?.sections).map(({ groupKey, title, items }) => (
            <div key={groupKey} className="lp-catalog-group">
              <h3 className="lp-catalog-group-title">{title}</h3>
              <div className="lp-zone-table">
                <div className="lp-zone-table-header">
                  <span>Зона</span>
                  <span>Время / сеанс</span>
                  <span>Кол-во сеансов / примечание</span>
                </div>
                {items.map((item) => {
                  const isInfo = item.type === "INFO";
                  return (
                    <div className="lp-zone-table-row" key={item.id}>
                      <span className="lp-zone-table-zone">{item.title}</span>
                      <span className="lp-zone-table-time">
                        {isInfo
                          ? (item.subtitle ?? "—")
                          : (item.subtitle ?? (item.durationMin != null ? `${item.durationMin} мин` : "—"))}
                      </span>
                      <span className="lp-zone-table-sessions">
                        {isInfo
                          ? (item.description ?? "—")
                          : (item.description ?? (item.price != null ? `${item.price} ₽` : "—"))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="lp-zones-note">
            <strong>Крупные зоны (ноги, спина)</strong> — для них эффективнее лазерная эпиляция. 
            Электро на больших зонах потребует многих часов работы и значительных затрат. 
            Мы честно скажем, что лучше подойдёт именно вам.
          </div>
        </div>
      </section>

      {/* ── Цены ── */}
      <section className="service-section" ref={refPrice}>
        <div className={`service-section-inner fade-in-up ${visiblePrice ? "visible" : ""}`}>
          <span className="lp-tag">Стоимость</span>
          <h2 className="service-h2">Прайс-лист</h2>
          <p className="lp-price-note-top">
            Электроэпиляция тарифицируется по времени — это честнее, 
            чем цена «за зону», потому что плотность волос у всех разная.
          </p>
          <p className="lp-price-note-top">
            Прайс-лист кликабельный. Нажмите на нужный пакет времени, чтобы быстро перейти в Telegram-бот и записаться без консультации. Если нужна консультация или подбор времени — воспользуйтесь кнопкой под прайс-листом.
          </p>
          {catalogLoading && <p className="lp-catalog-loading">Загрузка прайса…</p>}
          {catalogError && <p className="lp-catalog-error">Не удалось загрузить прайс. {catalogError}</p>}
          {!catalogLoading && !catalogError && (() => {
            const timeItems = getTimePackageItems(catalogData?.sections);
            return timeItems.length > 0 ? (
              <div className="lp-electro-price-grid">
                {timeItems.map((item) => (
                  <a
                    key={item.id}
                    href={buildTelegramLink(item.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lp-electro-price-card lp-electro-price-card--bookable"
                  >
                    <span className="lp-electro-price-time">{item.subtitle ?? (item.durationMin != null ? `${item.durationMin} мин` : item.title)}</span>
                    <span className="lp-electro-price-val">{item.price != null ? `${item.price} ₽` : "—"}</span>
                  </a>
                ))}
              </div>
            ) : null;
          })()}
          <div className="lp-electro-price-note">
            Первая консультация — бесплатно. Анестезирующий крем — 200 ₽ (при необходимости).
          </div>
          <div className="lp-price-cta">
            <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-primary">
              Консультация и подбор времени
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
                <li><strong>Не брейте зону</strong> за 3–5 дней — нужны волоски 2–4 мм</li>
                <li>Кожа чистая, без кремов и декоративной косметики</li>
                <li>Если нужна анестезия — нанесите крем за 40–60 мин (уточните у мастера)</li>
                <li>Не загорайте за неделю до процедуры</li>
                <li>Сообщите о кардиостимуляторе, эпилепсии, беременности, приёме препаратов</li>
              </ul>
            </div>
            <div className="lp-prep-card">
              <div className="lp-prep-card-header lp-prep-card-header--after">
                <span className="lp-prep-card-icon">✅</span>
                <h3>После процедуры</h3>
              </div>
              <ul className="lp-prep-list">
                <li>Лёгкое покраснение и корочки — норма, проходит за 2–7 дней</li>
                <li><strong>Не трогать</strong> корочки руками — дать отпасть самостоятельно</li>
                <li>Наносить антисептик (хлоргексидин) 2 раза в день первые 2–3 дня</li>
                <li><strong>48 часов</strong> — не посещать баню, сауну, бассейн</li>
                <li>SPF 50+ на обработанные зоны при выходе на солнце</li>
                <li>Не наносить декоративную косметику на зону 24–48 часов</li>
              </ul>
            </div>
            <div className="lp-prep-card">
              <div className="lp-prep-card-header lp-prep-card-header--contra">
                <span className="lp-prep-card-icon">⚠️</span>
                <h3>Противопоказания</h3>
              </div>
              <ul className="lp-prep-list">
                <li><strong>Абсолютные:</strong> кардиостимулятор, онкология</li>
                <li><strong>Абсолютные:</strong> беременность, эпилепсия</li>
                <li><strong>Абсолютные:</strong> острые воспаления в зоне обработки</li>
                <li><strong>Временные:</strong> герпес в стадии обострения в зоне</li>
                <li><strong>Временные:</strong> кожные инфекции в зоне</li>
                <li>При сомнениях — консультация дерматолога</li>
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
          <h2 className="service-cta-title">Запишитесь на электроэпиляцию</h2>
          <p className="service-cta-text">
            Расскажем, подходит ли вам этот метод, и составим реалистичный план. 
            Консультация бесплатно — без обязательств.
          </p>
          <a href={botUrl} target="_blank" rel="noopener noreferrer" className="service-btn-cta">
            Записаться в Telegram
          </a>
        </div>
      </section>

    </div>
  );
}
