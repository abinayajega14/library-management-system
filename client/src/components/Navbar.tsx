import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const memberLinks = [
  { label: "Catalog", to: "/" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "My Books", to: "/my-books" },
  { label: "History", to: "/history" },
  { label: "Profile", to: "/profile" },
];

const adminLinks = [
  { label: "Catalog", to: "/" },
  { label: "Admin", to: "/admin" },
  { label: "Add Book", to: "/admin/books/new" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-emerald-100 text-emerald-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = user?.role === "admin" ? adminLinks : memberLinks;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link className="text-lg font-bold tracking-tight text-emerald-900" to="/">
          Shelfwise
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {user ? (
            <>
              {links.map(({ label, to }) => (
                <NavLink className={linkClass} end={to === "/"} key={to} to={to}>
                  {label}
                </NavLink>
              ))}
              <span className="hidden px-2 text-sm text-slate-500 sm:inline">{user.name}</span>
              <button
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                onClick={handleLogout}
                type="button"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink className={linkClass} to="/login">
                Log in
              </NavLink>
              <NavLink className={linkClass} to="/register">
                Create account
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
