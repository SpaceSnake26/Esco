import { Link, useLocation } from "react-router-dom";

const items = [
  { to: "/", icon: "🏠", label: "Home" },
  { to: "/ruta", icon: "🧭", label: "Route" },
  { to: "/tarea", icon: "📚", label: "Homework" },
  { to: "/ranking", icon: "🏆", label: "Ranking" },
  { to: "/clase", icon: "🏫", label: "Class" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav style={{ position: "sticky", bottom: 0, display: "flex", justifyContent: "space-around",
      background: "#fff", borderTop: "1px solid #eee", padding: "8px 0" }}>
      {items.map((i) => (
        <Link key={i.to} to={i.to} aria-current={pathname === i.to ? "page" : undefined}
          style={{ textAlign: "center", fontSize: 11, textDecoration: "none",
          color: pathname === i.to ? "#0a6e5c" : "#999" }}>
          <div style={{ fontSize: 20 }} aria-hidden>{i.icon}</div>{i.label}
        </Link>
      ))}
    </nav>
  );
}
