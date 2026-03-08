import { useState, useEffect } from "react";
import { useScrollAnimation } from "./useScrollAnimation.js";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function SpecialistsSection() {
  const [ref, isVisible] = useScrollAnimation({ threshold: 0.1 });
  const [masters, setMasters] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    console.log("[SpecialistsSection] mounted");
    let cancelled = false;

    fetch(`${API_BASE}/public/masters`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.masters) ? data.masters : [];
        console.log("[SpecialistsSection] masters count:", list.length);
        setMasters(list);
        setLoaded(true);
      })
      .catch((err) => {
        console.error("[SpecialistsSection] fetch failed:", err);
        if (!cancelled) setLoaded(true);
      });

    return () => { cancelled = true; };
  }, []);

  if (!loaded || masters.length === 0) return null;

  return (
    <section className="land-section" ref={ref}>
      <div className={`land-section-inner fade-in-up ${isVisible ? "visible" : ""}`}>
        <p className="land-section-tag">Команда</p>
        <h2 className="land-h2">Наши специалисты</h2>

        <div className="land-masters-grid">
          {masters.map((m) => (
            <div key={m.id} className="land-master-card">
              <div className="land-master-avatar-wrap">
                {m.photoUrl ? (
                  <img
                    src={m.photoUrl}
                    alt={m.name || "Мастер"}
                    className="land-master-avatar"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="land-master-avatar"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#f0e6ef",
                      color: "#8b5c88",
                      fontSize: "28px",
                      fontWeight: 700,
                      borderRadius: "50%",
                    }}
                  >
                    {(m.name || "?").charAt(0)}
                  </div>
                )}
              </div>
              <strong className="land-master-name">{m.name || "—"}</strong>
              <p className="land-master-spec">{m.publicTitleRu || "Специалист"}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
