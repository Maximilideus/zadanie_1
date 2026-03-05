import { useEffect, useState } from "react";
import PropTypes from "prop-types";

/**
 * Фиксированная кнопка записи внизу экрана
 * Появляется при скролле вниз, скрывается на Hero и финальном CTA
 */
export function StickyBookButton({ botUrl }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Показываем после прокрутки вниз на 300px (после Hero)
      const showAfter = 300;
      
      // Скрываем за 400px до конца страницы (на финальном CTA)
      const hideBeforeEnd = 400;
      
      const shouldShow = 
        scrollY > showAfter && 
        scrollY < documentHeight - windowHeight - hideBeforeEnd;

      setIsVisible(shouldShow);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Проверяем сразу при монтировании

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <a
      href={botUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`sticky-book-btn ${isVisible ? "sticky-book-btn--visible" : ""}`}
      aria-label="Записаться в Telegram"
    >
      <span className="sticky-book-btn__icon">📱</span>
      <span className="sticky-book-btn__text">Записаться в Telegram</span>
    </a>
  );
}

StickyBookButton.propTypes = {
  botUrl: PropTypes.string.isRequired,
};
