import { useState } from "react";
import { supabase } from "../supabase.js";
import { showSuccessToast, showErrorToast } from "./CustomToast.jsx";

export function AuthForm({ onBack }) {
  const [email,      setEmail]      = useState("");
  const [code,       setCode]       = useState("");
  const [step,       setStep]       = useState("email"); // "email" | "code"
  const [isSending,  setIsSending]  = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Шаг 1 — отправляем OTP-код на email
  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) { showErrorToast("Введите email."); return; }

    setIsSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true }, // регистрируем если не существует
      });

      if (error) throw error;

      setStep("code");
      showSuccessToast("Код отправлен! Проверьте почту.");
    } catch (e) {
      console.error("Ошибка отправки кода:", e);
      showErrorToast("Не удалось отправить код. Проверьте email.");
    } finally {
      setIsSending(false);
    }
  };

  // Шаг 2 — проверяем введённый код
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (code.trim().length < 8) { showErrorToast("Введите 6-значный код."); return; }

    setIsVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type:  "email",
      });

      if (error) throw error;

      // Сессия установится автоматически через onAuthStateChange в App.jsx
      showSuccessToast("Вы вошли!");
    } catch (e) {
      console.error("Ошибка проверки кода:", e);
      showErrorToast("Неверный или устаревший код. Попробуйте ещё раз.");
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  };

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
            <h1 className="title">
              {step === "email" ? "Войти или зарегистрироваться" : "Введите код"}
            </h1>
            <p className="subtitle">
              {step === "email"
                ? "Введите email — мы пришлём 6-значный код. Пароль не нужен."
                : <>Мы отправили код на <strong>{email}</strong>.</>
              }
            </p>
          </header>

          {step === "email" ? (
            <form onSubmit={handleSendCode}>
              <div className="field-group">
                <label className="section-label" htmlFor="auth-email">Email</label>
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
                <button type="submit" className="btn-primary" disabled={isSending}>
                  {isSending ? "Отправляем…" : "Получить код"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode}>
              <div className="field-group">
                <label className="section-label" htmlFor="auth-code">Код из письма</label>
                <input
                  id="auth-code"
                  type="text"
                  inputMode="numeric"
                  className="auth-input auth-input--code"
                  placeholder="12345678"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  autoFocus
                  autoComplete="one-time-code"
                  maxLength={8}
                />
              </div>
              <div className="actions">
                <button type="submit" className="btn-primary" disabled={isVerifying}>
                  {isVerifying ? "Проверяем…" : "Войти"}
                </button>
              </div>
              {/* Отправить код повторно */}
              <p className="auth-resend-wrap">
                Не пришёл код?{" "}
                <button
                  type="button"
                  className="auth-resend"
                  onClick={() => { setStep("email"); setCode(""); }}
                >
                  Отправить снова
                </button>
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
