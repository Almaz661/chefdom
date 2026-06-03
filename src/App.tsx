import { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { RecipesPage } from "./pages/RecipesPage";
import { RecipeDetailPage } from "./pages/RecipeDetailPage";
import { AddRecipePage } from "./pages/AddRecipePage";
import { MenuPage } from "./pages/MenuPage";
import { MenuWeekPage } from "./pages/MenuWeekPage";
import { ShoppingPage } from "./pages/ShoppingPage";
import { InventoryPage } from "./pages/InventoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { WhatToCookPage } from "./pages/WhatToCookPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ReceiptDetailPage } from "./pages/ReceiptDetailPage";
import { PreservesPage } from "./pages/PreservesPage";
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
        path="/recipes/add"
        element={<PrivatePage><AddRecipePage /></PrivatePage>}
      />
      <Route
        path="/recipes/:id/edit"
        element={<PrivatePage><AddRecipePage /></PrivatePage>}
      />
      <Route
        path="/recipes/:id"
        element={<PrivatePage><RecipeDetailPage /></PrivatePage>}
      />
      <Route
        path="/menu"
        element={<PrivatePage><MenuWeekPage /></PrivatePage>}
      />
      <Route
        path="/shopping"
        element={<PrivatePage><ShoppingPage /></PrivatePage>}
      />
      <Route
        path="/inventory"
        element={<PrivatePage><InventoryPage /></PrivatePage>}
      />
      <Route
        path="/preserves"
        element={<PrivatePage><PreservesPage /></PrivatePage>}
      />
      <Route
        path="/settings"
        element={<PrivatePage><SettingsPage /></PrivatePage>}
      />
      <Route
        path="/products"
        element={<PrivatePage><ProductsPage /></PrivatePage>}
      />
      <Route
        path="/receipts"
        element={<PrivatePage><ReceiptsPage /></PrivatePage>}
      />
      <Route
        path="/receipts/:id"
        element={<PrivatePage><ReceiptDetailPage /></PrivatePage>}
      />
      <Route
        path="/what-to-cook"
        element={<PrivatePage><WhatToCookPage /></PrivatePage>}
      />
      <Route
        path="/history"
        element={<PrivatePage><HistoryPage /></PrivatePage>}
      />
      <Route
        path="/analytics"
        element={<PrivatePage><AnalyticsPage /></PrivatePage>}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
