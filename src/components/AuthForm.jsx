import { useState } from "react";
import { supabase } from "../supabase.js";
import { showSuccessToast, showErrorToast } from "./CustomToast.jsx";

export function AuthForm({ onBack }) {
  const [email,       setEmail]       = useState("");
  const [isSending,   setIsSending]   = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showErrorToast("Введите email.");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // После клика по ссылке — вернуться на главную страницу
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      setIsEmailSent(true);
      showSuccessToast("Ссылка отправлена! Проверьте почту.");
    } catch (e) {
      console.error("Ошибка отправки Magic Link:", e);
      showErrorToast("Не удалось отправить ссылку. Проверьте email.");
    } finally {
      setIsSending(false);
    }
  };

  // После отправки — показываем подтверждение
  if (isEmailSent) {
    return (
      <div className="root-bg">
        <main className="page">
          <section className="card">
            <div className="auth-sent">
              <div className="auth-sent-icon">✉️</div>
              <h2 className="auth-title">Проверьте почту</h2>
              <p className="auth-subtitle">
                Мы отправили ссылку для входа на <strong>{email}</strong>.
                Нажмите на неё — и вы сразу окажетесь в приложении.
              </p>
              <button
                type="button"
                className="auth-resend"
                onClick={() => setIsEmailSent(false)}
              >
                Отправить снова
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="root-bg">
      <main className="page">
        <section className="card">
          <header className="card-header">
              {onBack && (
                <button type="button" className="back-btn" onClick={onBack}>
                  ← Вернуться
                </button>
              )}
              <h1 className="title">Войти или зарегистрироваться</h1>
              <p className="subtitle">
                Введите email — мы пришлём ссылку для входа. Пароль не нужен.
              </p>
            </header>

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="section-label" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                className="auth-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={isSending}
              >
                {isSending ? "Отправляем…" : "Получить ссылку для входа"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
