import { Link, Route, Routes } from "react-router-dom";
import Alert from "./components/Alert";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import BookDetailsPage from "./pages/BookDetailsPage";
import BookFormPage from "./pages/BookFormPage";
import CatalogPage from "./pages/CatalogPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import MemberDashboardPage from "./pages/MemberDashboardPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import MyBooksPage from "./pages/MyBooksPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useAuth } from "./context/useAuth";

function NotFoundPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">This page is not available.</p>
      <Link className="mt-5 inline-block font-semibold text-emerald-800 hover:underline" to="/login">
        Go to login
      </Link>
    </section>
  );
}

export default function App() {
  const { restoreError } = useAuth();

  return (
    <div className="min-h-screen">
      <Navbar />
      {restoreError && (
        <div className="mx-auto max-w-6xl px-4 pt-5">
          <Alert variant="error" message={restoreError} />
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route
            element={
              <ProtectedRoute>
                <CatalogPage />
              </ProtectedRoute>
            }
            path="/"
          />
          <Route element={<LoginPage />} path="/login" />
          <Route element={<RegisterPage />} path="/register" />
          <Route element={<ForgotPasswordPage />} path="/forgot-password" />
          <Route element={<ResetPasswordPage />} path="/reset-password" />
          <Route
            element={
              <ProtectedRoute>
                <BookDetailsPage />
              </ProtectedRoute>
            }
            path="/books/:id"
          />
          <Route
            element={
              <ProtectedRoute role="member">
                <MemberDashboardPage />
              </ProtectedRoute>
            }
            path="/dashboard"
          />
          <Route
            element={
              <ProtectedRoute>
                <MyBooksPage />
              </ProtectedRoute>
            }
            path="/my-books"
          />
          <Route
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
            path="/history"
          />
          <Route
            element={
              <ProtectedRoute role="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
            path="/admin"
          />
          <Route
            element={
              <ProtectedRoute role="admin">
                <BookFormPage />
              </ProtectedRoute>
            }
            path="/admin/books/new"
          />
          <Route
            element={
              <ProtectedRoute role="admin">
                <BookFormPage />
              </ProtectedRoute>
            }
            path="/admin/books/:id/edit"
          />
          <Route
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
            path="/profile"
          />
          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </main>
    </div>
  );
}
