import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage.jsx";
import { LaserPage } from "./pages/LaserPage.jsx";
import { WaxPage } from "./pages/WaxPage.jsx";
import { ElectroPage } from "./pages/ElectroPage.jsx";
import { AuthForm } from "./components/AuthForm.jsx";
import { AdminPanel } from "./components/AdminPanel.jsx";
import { supabase } from "./supabase.js";

// ─── Админ: замени на свой email ─────────────────────────────────────────
const ADMIN_EMAIL = "your-email@example.com";

// ─── Ссылка на Telegram-бота ─────────────────────────────────────────────
export const BOT_URL = "https://t.me/LaserBook_bot";

export const MASTERS_DATA = {
  "Анна":    { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Anna",   rating: 4.9, specialization: "Депиляция" },
  "Мария":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Maria",  rating: 4.7, specialization: "Депиляция" },
  "Елена":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Elena",  rating: 4.8, specialization: "Массаж и депиляция" },
  "Дмитрий": { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Dmitry", rating: 4.6, specialization: "Массаж" },
};

export function App() {
  const [session, setSession] = useState(undefined);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setShowAdmin(false);
    setShowLogin(false);
  };

  if (session === undefined) return null;

  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  if (showAdmin && isAdmin) {
    return <AdminPanel session={session} onBack={() => setShowAdmin(false)} onSignOut={handleSignOut} />;
  }

  if (showLogin && !session) {
    return <AuthForm onBack={() => setShowLogin(false)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <HomePage
              botUrl={BOT_URL}
              isAdmin={isAdmin}
              session={session}
              onAdminClick={() => setShowAdmin(true)}
              onLoginClick={() => setShowLogin(true)}
              onSignOut={handleSignOut}
            />
          } 
        />
        <Route path="/laser" element={<LaserPage botUrl={BOT_URL} />} />
        <Route path="/wax" element={<WaxPage botUrl={BOT_URL} />} />
        <Route path="/electro" element={<ElectroPage botUrl={BOT_URL} />} />
      </Routes>
    </BrowserRouter>
  );
}
