import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Download, FolderDown, ChefHat, BookOpen, Youtube, Loader2 } from "lucide-react";
import { trpc } from "../utils/trpc";
import { RecipeImportDialog } from "../components/RecipeImportDialog";
import { SectionImportDialog } from "../components/SectionImportDialog";

// Пустое состояние когда в БД ровно 0 рецептов.
function EmptyState({ onImport, onSection }: { onImport: () => void; onSection: () => void }) {
  return (
    <div className="bg-surface-elevated border border-line border-dashed rounded-2xl p-10 text-center">
      <BookOpen
        size={48}
        className="text-line-strong mx-auto mb-4"
        strokeWidth={1.5}
      />
      <h2 className="font-serif text-2xl font-semibold text-ink mb-2">
        В книге пока нет рецептов
      </h2>
      <p className="text-ink-soft mb-6 max-w-md mx-auto">
        Добавь первый рецепт вручную или импортируй сразу с сайта — потом
        систему можно наполнить раздел за разделом.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/recipes/add"
          className="inline-flex items-center gap-2 bg-primary text-paper px-4 py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus size={18} />
          Добавить вручную
        </Link>
        <button
          type="button"
          onClick={onImport}
          className="inline-flex items-center gap-2 bg-paper text-ink border border-line px-4 py-2.5 rounded-lg font-medium hover:border-primary hover:text-primary transition-colors"
        >
          <Download size={18} />
          Импорт с сайта
        </button>
        <button
          type="button"
          onClick={onSection}
          className="inline-flex items-center gap-2 bg-paper text-ink border border-line px-4 py-2.5 rounded-lg font-medium hover:border-primary hover:text-primary transition-colors"
        >
          <FolderDown size={18} />
          Импорт раздела
        </button>
      </div>
    </div>
  );
}

// Карточка рецепта — фото 16:10, название serif, факты sans muted.
interface RecipeCardData {
  id: number;
  title: string;
  imageUrl: string | null;
  totalTime: number | null;
  servings: number;
  difficulty: string | null;
}

function RecipeCard({ r }: { r: RecipeCardData }) {
  const [imgError, setImgError] = useState(false);
  const showImage = r.imageUrl && !imgError;
  return (
    <Link
      to={`/recipes/${r.id}`}
      className="block bg-surface-elevated rounded-xl border border-line overflow-hidden card-lift"
    >
      <div className="aspect-[16/10] bg-surface-hover overflow-hidden">
        {showImage ? (
          <img
            src={r.imageUrl!}
            alt={r.title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat
              size={36}
              className="text-line-strong"
              strokeWidth={1.5}
            />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-lg font-semibold text-ink mb-1 line-clamp-2 leading-tight">
          {r.title}
        </h3>
        <p className="text-ink-soft text-sm">
          {[
            r.totalTime ? `${r.totalTime} мин` : null,
            `${r.servings} порц.`,
            r.difficulty,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}

export function RecipesPage() {
  // Debounced search — ввод и применённое значение раздельны.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const stats = trpc.recipes.getStats.useQuery();
  const cats = trpc.recipes.getCategories.useQuery();

  const list = trpc.recipes.list.useInfiniteQuery(
    { search: search || undefined, category },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  );

  // IntersectionObserver — подгрузка при скролле к sentinel-элементу.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!list.hasNextPage || list.isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) list.fetchNextPage();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [list.hasNextPage, list.isFetchingNextPage, list.fetchNextPage]);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = stats.data?.total ?? 0;
  const isEmpty = total === 0;
  const categories = cats.data ?? [];

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:py-12">
      {/* Заголовок страницы */}
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Рецепты
          </h1>
          {!isEmpty && (
            <span className="text-ink-muted text-xs">
              {total} в книге
            </span>
          )}
        </div>
      </header>

      {/* Действия — поиск + кнопки добавить/импорт. Скрыты в полностью пустом состоянии (там свои CTA). */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              strokeWidth={2}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full bg-paper border border-line rounded-lg pl-10 pr-4 h-12 text-ink placeholder:text-ink-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <Link
            to="/recipes/add"
            className="inline-flex items-center gap-2 bg-primary text-paper px-4 h-12 rounded-lg font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus size={18} />
            Добавить
          </Link>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 bg-paper text-ink border border-line px-4 h-12 rounded-lg font-medium hover:border-primary hover:text-primary transition-colors"
          >
            <Download size={18} />
            Импорт
          </button>
          <button
            type="button"
            onClick={() => setSectionOpen(true)}
            className="inline-flex items-center gap-2 bg-paper text-ink border border-line px-4 h-12 rounded-lg font-medium hover:border-primary hover:text-primary transition-colors"
          >
            <FolderDown size={18} />
            Раздел
          </button>
          <button
            type="button"
            onClick={() => setYoutubeOpen(true)}
            className="inline-flex items-center gap-2 bg-paper text-ink border border-line px-4 h-12 rounded-lg font-medium hover:border-red-500 hover:text-red-500 transition-colors"
          >
            <Youtube size={18} />
            YouTube
          </button>
        </div>
      )}

      {/* Чипы категорий */}
      {!isEmpty && categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setCategory(undefined)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === undefined
                ? "bg-primary text-paper"
                : "bg-paper text-ink-soft border border-line hover:border-primary"
            }`}
          >
            Все
          </button>
          {categories.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() =>
                setCategory(category === c.category ? undefined : c.category)
              }
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === c.category
                  ? "bg-primary text-paper"
                  : "bg-paper text-ink-soft border border-line hover:border-primary"
              }`}
            >
              {c.category}{" "}
              <span className="text-xs opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Контент */}
      {stats.isLoading ? (
        <div className="text-ink-muted text-sm">Загрузка...</div>
      ) : isEmpty ? (
        <EmptyState onImport={() => setImportOpen(true)} onSection={() => setSectionOpen(true)} />
      ) : items.length === 0 && !list.isLoading ? (
        <div className="text-center text-ink-soft py-12">
          Ничего не найдено. Попробуй другой запрос или фильтр.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>

          {/* Sentinel для IntersectionObserver */}
          {list.hasNextPage && (
            <div
              ref={sentinelRef}
              className="h-12 flex items-center justify-center text-ink-muted text-sm mt-6"
            >
              {list.isFetchingNextPage ? "Загружаю ещё..." : ""}
            </div>
          )}
        </>
      )}

      <RecipeImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <SectionImportDialog
        open={sectionOpen}
        onClose={() => setSectionOpen(false)}
      />
      {youtubeOpen && (
        <YouTubeImportDialog onClose={() => setYoutubeOpen(false)} />
      )}
    </div>
  );
}

// --- YouTube Import Dialog ---
function YouTubeImportDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const importYt = trpc.recipes.importFromYoutube.useMutation({
    onSuccess: (result) => {
      utils.recipes.list.invalidate();
      utils.recipes.getStats.invalidate();
      onClose();
      navigate(`/recipes/${result.id}`);
    },
  });

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-end sm:items-center justify-center z-50"
      onClick={() => !importYt.isPending && onClose()}
    >
      <div
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl font-semibold text-ink mb-2 flex items-center gap-2">
          <Youtube size={22} className="text-red-500" />
          Импорт из YouTube
        </h3>
        <p className="text-sm text-ink-soft mb-4">
          Вставь ссылку на видео с рецептом. AI извлечёт ингредиенты и шаги из описания и субтитров.
        </p>

        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          autoFocus
          className="w-full h-12 px-4 bg-surface-elevated border border-line rounded-lg text-ink focus:outline-none focus:border-primary mb-4"
        />

        {importYt.error && (
          <p className="text-sm text-alert mb-4">{importYt.error.message}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={importYt.isPending}
            className="flex-1 h-12 rounded-lg border border-line text-ink-soft font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!url.trim() || importYt.isPending}
            onClick={() => importYt.mutate({ url: url.trim() })}
            className="flex-1 h-12 rounded-lg bg-primary text-paper font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            {importYt.isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Извлекаю...
              </>
            ) : (
              "Импортировать"
            )}
          </button>
        </div>

        {importYt.isPending && (
          <p className="text-xs text-ink-muted text-center mt-3">
            AI анализирует видео... Обычно 10-20 секунд.
          </p>
        )}
      </div>
    </div>
  );
}
