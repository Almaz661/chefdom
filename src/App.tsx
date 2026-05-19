import { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { isAuthenticated } from "./utils/auth";

function PrivateRoute({ children }: { children: ReactElement }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

// Заглушка вместо Dashboard — настоящий Dashboard будет в Блоке 3.
function HomePlaceholder() {
  return (
    <div className="p-6 lg:p-10">
      <h1 className="font-serif text-3xl font-semibold text-ink mb-3">
        Главная
      </h1>
      <p className="text-ink-soft text-base max-w-prose">
        Ты вошла. Это заглушка — настоящая главная страница (приветствие, блюдо
        дня, алерты сроков, две главные карточки) появится в Блоке 3.
      </p>
      <p className="text-ink-muted text-sm mt-4">
        Пункты навигации слева пока ведут на несуществующие страницы — это
        нормально, они появятся в следующих блоках.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout>
              <HomePlaceholder />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
