import { useState, useEffect, FormEvent } from "react";
import { daysUntilExpiry } from '../utils/dateUtils';
import {
  Snowflake,
  Archive,
  PackageOpen,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Sparkles,
  ChefHat,
  Minus,
} from "lucide-react";
import { trpc } from "../utils/trpc";
import { toast } from "../components/ui/Toast";

// Этап D — заготовки. Четыре типа в одной таблице, переключение табами.
//
//  ❄️ Заморозка   — котлеты, фарш, ягоды; есть поле «порции»
//  🫙 Консервация — варенье, соленья, маринады; дата заготовки + срок
//  🥒 Открытые    — открытые банки/пачки; дата открытия + годен до
//  👨‍🍳 Готовые     — приготовленные блюда; порции, срок хранения

type PreserveType = "frozen" | "preserved" | "opened" | "cooked";

const TABS: {
  key: PreserveType;
  label: string;
  shortLabel: string;
  icon: typeof Snowflake;
}[] = [
  { key: "cooked", label: "Готовые блюда", shortLabel: "Готовые", icon: ChefHat },
  { key: "frozen", label: "Заморозка", shortLabel: "Заморозка", icon: Snowflake },
  { key: "preserved", label: "Консервация", shortLabel: "Консервация", icon: Archive },
  { key: "opened", label: "Открытые продукты", shortLabel: "Открытые", icon: PackageOpen },
];

function tabConfig(t: PreserveType) {
  return TABS.find((x) => x.key === t)!;
}

/** Сколько дней до истечения срока. null — если срок не указан. */

function expiryText(expiryDate: string | null): string {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return "";
  if (days < 0) return "просрочен";
  if (days === 0) return "истекает сегодня";
  if (days === 1) return "истекает завтра";
  if (days <= 7) return `истекает через ${days} дн.`;
  if (days <= 30) return `ещё ${days} дн.`;
  // Длинные сроки — показываем дату
  const d = new Date(expiryDate + "T00:00:00");
  return `до ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;
}

function preparedText(preparedAt: string | null, type: PreserveType): string {
  if (!preparedAt) return "";
  const d = new Date(preparedAt + "T00:00:00");
  const formatted = d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (type === "frozen") return `заморозили ${formatted}`;
  if (type === "preserved") return `заготовлено ${formatted}`;
  if (type === "cooked") return `приготовлено ${formatted}`;
  return `открыто ${formatted}`;
}

export function PreservesPage() {
  const [tab, setTab] = useState<PreserveType>("cooked");
  const [showAdd, setShowAdd] = useState(false);

  const utils = trpc.useUtils();
  const { data: allItems = [], isLoading } = trpc.preserves.list.useQuery();

  const remove = trpc.preserves.remove.useMutation({
    onSuccess: () => utils.preserves.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const consumeServings = trpc.preserves.consumeServings.useMutation({
    onSuccess: () => utils.preserves.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  // Фильтр по табу
  const items = allItems.filter((i) => i.preserveType === tab);

  // Скоро истекает (<=3 дней)
  const expiring = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days !== null && days <= 3;
  });
  const normal = items.filter((i) => {
    const days = daysUntilExpiry(i.expiryDate);
    return days === null || days > 3;
  });

  const tabIcon = tabConfig(tab).icon;
  const TabIconComp = tabIcon;

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
    <div className="max-w-2xl mx-auto px-5 py-8 lg:py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-3xl font-bold text-white/80">
          Заготовки
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="w-9 h-9 btn-gold flex items-center justify-center"
          aria-label="Добавить заготовку"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Табы */}
      <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1 mb-6">
        {TABS.map(({ key, shortLabel, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-base font-semibold transition-colors ${
              tab === key
                ? "bg-[var(--color-primary)] text-[#0a0c10] font-bold"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <Icon size={18} />
            <span className="hidden sm:inline">{shortLabel}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
        </div>
      ) : (
        <>
          {/* Скоро истекает */}
          {expiring.length > 0 && (
            <section className="mb-6">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={14} />
                Скоро истекает
              </h3>
              <ul className="space-y-1">
                {expiring.map((item) => {
                  const days = daysUntilExpiry(item.expiryDate);
                  const isExpired = days !== null && days < 0;
                  return (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${
                        isExpired
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-amber-500/10 border-amber-500/20"
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isExpired ? "bg-red-400" : "bg-amber-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-white/80 truncate">
                          {item.name}
                          {item.quantity && (
                            <span className="text-white/40 ml-1">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
                          )}
                          {tab === "frozen" && item.servings && (
                            <span className="text-white/40 ml-1">
                              · {item.servings} порц.
                            </span>
                          )}
                          {tab === "cooked" && item.servings && (
                            <span className="text-white/40 ml-1">
                              · {item.servings} порц.
                            </span>
                          )}
                        </p>
                        <p
                          className={`text-xs ${
                            isExpired ? "text-red-400" : "text-amber-400"
                          }`}
                        >
                          {expiryText(item.expiryDate)}
                        </p>
                      </div>
                      {(tab === "cooked" || tab === "frozen") && item.servings && item.servings > 0 && (
                        <button
                          onClick={() => consumeServings.mutate({ id: item.id, count: 1 })}
                          disabled={consumeServings.isPending}
                          className="flex items-center gap-1 px-2.5 h-8 text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors shrink-0 border border-[var(--color-primary)]/40 rounded-lg"
                          aria-label="Съели порцию"
                          title="Списать 1 съеденную порцию"
                        >
                          <Minus size={14} />
                          Съесть
                        </button>
                      )}
                      <button
                        onClick={() => remove.mutate({ id: item.id })}
                        className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors shrink-0"
                        aria-label="Удалить"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Основной список */}
          {items.length === 0 ? (
            <div className="card-dark border-dashed rounded-2xl p-8 text-center">
              <TabIconComp
                size={32}
                className="text-white/[0.06] mx-auto mb-3"
                strokeWidth={1.5}
              />
              <p className="text-white/60 text-sm">
                {tab === "cooked" &&
                  "Пусто. После готовки блюда автоматически появятся здесь."}
                {tab === "frozen" &&
                  "Пусто. Добавь котлеты, фарш или ягоды кнопкой [+]."}
                {tab === "preserved" &&
                  "Пусто. Добавь варенье, соленья или маринады кнопкой [+]."}
                {tab === "opened" &&
                  "Пусто. Добавь открытую банку или пачку кнопкой [+]."}
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {normal.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-4 py-3 border border-[var(--color-line)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-white/80 truncate">
                      {item.name}
                      {item.quantity && (
                        <span className="text-white/40 ml-1">
                          {item.quantity}
                          {item.unit ? ` ${item.unit}` : ""}
                        </span>
                      )}
                      {(tab === "frozen" || tab === "cooked") && item.servings && (
                        <span className="text-white/40 ml-1">
                          · {item.servings} порц.
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-base text-white/80 font-medium-muted font-medium">
                      {item.preparedAt && (
                        <span>{preparedText(item.preparedAt, tab)}</span>
                      )}
                      {item.expiryDate && <span>{expiryText(item.expiryDate)}</span>}
                    </div>
                  </div>
                  {(tab === "cooked" || tab === "frozen") && item.servings && item.servings > 0 && (
                    <button
                      onClick={() => consumeServings.mutate({ id: item.id, count: 1 })}
                      disabled={consumeServings.isPending}
                      className="flex items-center gap-1 px-2.5 h-8 text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors shrink-0 border border-[var(--color-primary)]/40 rounded-lg"
                      aria-label="Съели порцию"
                      title="Списать 1 съеденную порцию"
                    >
                      <Minus size={14} />
                      Съесть
                    </button>
                  )}
                  <button
                    onClick={() => remove.mutate({ id: item.id })}
                    className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors shrink-0"
                    aria-label="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Диалог добавления */}
      {showAdd && (
        <AddPreserveDialog
          preserveType={tab}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
    </div>
  );
}

// --- Диалог добавления ---

function AddPreserveDialog({
  preserveType,
  onClose,
}: {
  preserveType: PreserveType;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [servings, setServings] = useState("");
  const [preparedAt, setPreparedAt] = useState(today);
  const [expiryDate, setExpiryDate] = useState("");
  // Подсказка от справочника шефа: какой ключ совпал и какой срок дан.
  // Показываем только для frozen — для других типов нет смысла авто-считать.
  const [shelfHint, setShelfHint] = useState<{ keyword: string; days: number } | null>(null);
  // Помечаем что пользователь сам редактировал поле даты — тогда не
  // перезатираем его автоподсказкой при изменении названия.
  const [expiryDirty, setExpiryDirty] = useState(false);

  const utils = trpc.useUtils();

  const add = trpc.preserves.add.useMutation({
    onSuccess: () => {
      utils.preserves.list.invalidate();
      onClose();
    },
  });

  // Авто-подстановка срока хранения для типа frozen.
  // Дебаунс 400 мс — не заваливаем сервер при наборе по букве.
  // Срабатывает на изменение name или preparedAt.
  // Не трогает expiryDate если пользователь его сам менял (expiryDirty).
  useEffect(() => {
    if (preserveType !== "frozen") {
      setShelfHint(null);
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setShelfHint(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await utils.preserves.suggestExpiry.fetch({
          name: trimmed,
          preparedAt: preparedAt || undefined,
        });
        if (cancelled) return;
        if (res.matched) {
          setShelfHint({ keyword: res.keyword, days: res.days });
          if (!expiryDirty) {
            setExpiryDate(res.expiryDate);
          }
        } else {
          setShelfHint(null);
        }
      } catch {
        // Молча игнорируем — авто-подсказка не критична
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, preparedAt, preserveType]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    add.mutate({
      preserveType,
      name: name.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: unit.trim() || null,
      servings:
        (preserveType === "frozen" || preserveType === "cooked") && servings ? Number(servings) : null,
      preparedAt: preparedAt || null,
      expiryDate: expiryDate || null,
    });
  };

  const config = tabConfig(preserveType);
  const TitleIcon = config.icon;

  // Подсказки в плейсхолдерах подстраиваются под тип
  const namePlaceholder =
    preserveType === "cooked"
      ? "Например: Борщ"
      : preserveType === "frozen"
        ? "Например: Котлеты говяжьи"
        : preserveType === "preserved"
          ? "Например: Варенье малиновое"
          : "Например: Майонез открытый";

  const preparedLabel =
    preserveType === "cooked"
      ? "Дата приготовления"
      : preserveType === "frozen"
        ? "Дата заморозки"
        : preserveType === "preserved"
          ? "Дата заготовки"
          : "Дата открытия";

  const expiryLabel =
    preserveType === "cooked"
      ? "Годен до (обычно 3 дня)"
      : preserveType === "frozen"
        ? "Хранить до (необязательно)"
        : "Годен до (необязательно)";

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-paper)] border border-[var(--color-line)] rounded-2xl w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-semibold text-white/80 mb-1 inline-flex items-center gap-2">
          <TitleIcon size={20} className="text-[var(--color-primary)]" />
          Добавить: {config.label}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            autoFocus
            required
            className="w-full h-12 px-4 input-dark"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Кол-во"
              step="any"
              min="0"
              className="flex-1 h-12 px-4 input-dark"
            />
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ед. (кг, г, шт)"
              className="w-28 h-12 px-4 input-dark"
            />
          </div>
          {(preserveType === "frozen" || preserveType === "cooked") && (
            <input
              type="number"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="Порций (необязательно)"
              step="1"
              min="1"
              className="w-full h-12 px-4 input-dark"
            />
          )}
          <label className="block">
            <span className="block text-base text-white/60 font-medium-soft font-medium mb-1">
              {preparedLabel}
            </span>
            <input
              type="date"
              value={preparedAt}
              onChange={(e) => setPreparedAt(e.target.value)}
              className="w-full h-12 px-4 input-dark [color-scheme:dark]"
            />
          </label>
          <label className="block">
            <span className="block text-base text-white/60 font-medium-soft font-medium mb-1">
              {expiryLabel}
            </span>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => {
                setExpiryDate(e.target.value);
                setExpiryDirty(true);
              }}
              className="w-full h-12 px-4 input-dark [color-scheme:dark]"
            />
            {/* Шеф-подсказка: показываем только для frozen и если справочник
                нашёл совпадение. Если пользователь сам ввёл дату — мягко
                напоминаем что подсказка проигнорирована (но не давим). */}
            {preserveType === "frozen" && shelfHint && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-green-400">
                <Sparkles size={12} />
                Шеф советует: «{shelfHint.keyword}» — {shelfHint.days} дн.
                {expiryDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      // Возвращаем подсказанную дату — пересчитаем от preparedAt + days
                      const base = preparedAt
                        ? new Date(preparedAt + "T00:00:00")
                        : new Date();
                      base.setDate(base.getDate() + shelfHint.days);
                      setExpiryDate(base.toISOString().slice(0, 10));
                      setExpiryDirty(false);
                    }}
                    className="ml-1 text-[var(--color-primary)] underline"
                  >
                    применить
                  </button>
                )}
              </span>
            )}
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 btn-ghost"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim() || add.isPending}
              className="flex-1 h-12 btn-gold"
            >
              {add.isPending ? "Добавляю…" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
