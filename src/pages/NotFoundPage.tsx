import { useNavigate } from "react-router-dom";
import { ChefHat } from "lucide-react";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-8 text-center">
      <ChefHat size={64} className="text-primary mb-6" strokeWidth={1.5} />
      <h1 className="font-serif text-4xl font-semibold text-ink mb-3">404</h1>
      <p className="text-xl font-serif text-ink mb-2">Страница не найдена</p>
      <p className="text-ink-muted mb-8">
        Такой страницы не существует или она была удалена
      </p>
      <button
        onClick={() => navigate("/")}
        className="h-12 px-8 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark transition-colors"
      >
        На главную
      </button>
    </div>
  );
}
