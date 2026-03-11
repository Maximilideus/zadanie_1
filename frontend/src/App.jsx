import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage.jsx";
import { LaserPage } from "./pages/LaserPage.jsx";
import { WaxPage } from "./pages/WaxPage.jsx";
import { ElectroPage } from "./pages/ElectroPage.jsx";
import { AdminLoginPage } from "./pages/AdminLoginPage.jsx";
import { AdminBookingsPage } from "./pages/AdminBookingsPage.jsx";
import { AdminCatalogPage } from "./pages/AdminCatalogPage.jsx";
import { AdminServicesPage } from "./pages/AdminServicesPage.jsx";
import { AdminPackagesPage } from "./pages/AdminPackagesPage.jsx";
import { AdminSubscriptionsPage } from "./pages/AdminSubscriptionsPage.jsx";
import { AdminMastersPage } from "./pages/AdminMastersPage.jsx";
import { AdminZonesPage } from "./pages/AdminZonesPage.jsx";
import { getAdminMe, getAdminToken } from "./api/admin.js";

export const TELEGRAM_BOOK_URL = "https://t.me/my_salon_ai_assistant_bot";

export const MASTERS_DATA = {
  "Анна":    { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Anna",   rating: 4.9, specialization: "Депиляция" },
  "Мария":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Maria",  rating: 4.7, specialization: "Депиляция" },
  "Елена":   { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Elena",  rating: 4.8, specialization: "Массаж и депиляция" },
  "Дмитрий": { photo: "https://api.dicebear.com/7.x/personas/svg?seed=Dmitry", rating: 4.6, specialization: "Массаж" },
};

function AdminGuard({ adminUser, children }) {
  if (!adminUser) return <Navigate to="/admin/login" replace />;
  return children;
}

export function App() {
  const [adminUser, setAdminUser] = useState(null);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) {
      setAdminChecked(true);
      return;
    }
    getAdminMe()
      .then((user) => setAdminUser(user))
      .finally(() => setAdminChecked(true));
  }, []);

  const handleLoginSuccess = useCallback(() => {
    getAdminMe().then((user) => setAdminUser(user));
  }, []);

  const handleLogout = useCallback(() => {
    setAdminUser(null);
  }, []);

  if (!adminChecked) return null;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage botUrl={TELEGRAM_BOOK_URL} />} />
        <Route path="/laser" element={<LaserPage botUrl={TELEGRAM_BOOK_URL} />} />
        <Route path="/wax" element={<WaxPage botUrl={TELEGRAM_BOOK_URL} />} />
        <Route path="/electro" element={<ElectroPage botUrl={TELEGRAM_BOOK_URL} />} />

        {/* Admin routes */}
        <Route
          path="/admin/login"
          element={
            adminUser
              ? <Navigate to="/admin/bookings" replace />
              : <AdminLoginPage onLoginSuccess={handleLoginSuccess} />
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <AdminGuard adminUser={adminUser}>
              <AdminBookingsPage adminUser={adminUser} onLogout={handleLogout} />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/catalog"
          element={
            <AdminGuard adminUser={adminUser}>
              <AdminCatalogPage adminUser={adminUser} onLogout={handleLogout} />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/services"
          element={
            <AdminGuard adminUser={adminUser}>
              <AdminServicesPage adminUser={adminUser} onLogout={handleLogout} />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/packages"
          element={
            <AdminGuard adminUser={adminUser}>
              <AdminPackagesPage adminUser={adminUser} onLogout={handleLogout} />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/subscriptions"
          element={
            <AdminGuard adminUser={adminUser}>
              <AdminSubscriptionsPage adminUser={adminUser} onLogout={handleLogout} />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/masters"
          element={
            <AdminGuard adminUser={adminUser}>
              <AdminMastersPage adminUser={adminUser} onLogout={handleLogout} />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/zones"
          element={
            <AdminGuard adminUser={adminUser}>
              <AdminZonesPage adminUser={adminUser} onLogout={handleLogout} />
            </AdminGuard>
          }
        />
        <Route path="/admin" element={<Navigate to="/admin/bookings" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
