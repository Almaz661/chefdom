import { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { RecipesPage } from "./pages/RecipesPage";
import { RecipeDetailPage } from "./pages/RecipeDetailPage";
import { isAuthenticated } from "./utils/auth";

// Helper: страница за PIN, обёрнутая в общий Layout (сайдбар + нижняя нав).
function PrivatePage({ children }: { children: ReactElement }) {
  return isAuthenticated() ? (
    <Layout>{children}</Layout>
  ) : (
    <Navigate to="/login" replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivatePage><Dashboard /></PrivatePage>} />
      <Route
        path="/recipes"
        element={<PrivatePage><RecipesPage /></PrivatePage>}
      />
      <Route
        path="/recipes/:id"
        element={<PrivatePage><RecipeDetailPage /></PrivatePage>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
