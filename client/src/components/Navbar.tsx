import { useEffect, useRef, useState } from "react";
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
  { label: "My Books", to: "/my-books" },
  { label: "History", to: "/history" },
  { label: "Profile", to: "/profile" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-emerald-100 text-emerald-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const logoutDialogRef = useRef<HTMLDialogElement>(null);
  const links = user?.role === "admin" ? adminLinks : memberLinks;

  useEffect(() => {
    const dialog = logoutDialogRef.current;
    if (logoutConfirmationOpen && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [logoutConfirmationOpen]);

  function handleLogout() {
    setLogoutConfirmationOpen(true);
  }

  function cancelLogout() {
    logoutDialogRef.current?.close();
    setLogoutConfirmationOpen(false);
  }

  function confirmLogout() {
    logoutDialogRef.current?.close();
    setLogoutConfirmationOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link className="flex flex-col leading-tight text-emerald-900" to="/">
          <span className="text-lg font-bold tracking-tight">ShelfWise</span>
          <span className="mt-1 text-xs font-medium text-slate-600">Made with ♥ by Ibaa</span>
          <span className="mt-0.5 text-[11px] text-slate-500">
            Your books, beautifully organized.
          </span>
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
      {logoutConfirmationOpen && (
        <dialog
          aria-describedby="logout-confirmation-description"
          aria-labelledby="logout-confirmation-title"
          className="m-auto w-[min(100%-2rem,24rem)] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
          onCancel={() => setLogoutConfirmationOpen(false)}
          ref={logoutDialogRef}
        >
          <div className="p-6">
            <h2 className="text-lg font-semibold" id="logout-confirmation-title">
              Confirm logout
            </h2>
            <p className="mt-2 text-sm text-slate-600" id="logout-confirmation-description">
              Are you sure you want to log out?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                autoFocus
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={cancelLogout}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                onClick={confirmLogout}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </dialog>
      )}
    </header>
  );
}
