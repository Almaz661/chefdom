import { useState, FormEvent } from 'react';
import { Plus } from 'lucide-react';

export function ShoppingAddForm({
  onAdd,
  isPending,
}: {
  onAdd: (productName: string) => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Добавить продукт..."
        className="flex-1 h-12 px-4 bg-white/[0.04] border border-[var(--cd-line)] rounded-xl text-base font-medium text-white placeholder-white/25 focus:outline-none focus:border-[var(--cd-gold)]/50 transition-colors"
      />
      <button
        type="submit"
        disabled={!value.trim() || isPending}
        className="w-12 h-12 rounded-xl bg-gradient-to-r from-[var(--cd-gold)] to-[var(--cd-gold)] text-[#0a0c10] flex items-center justify-center hover:shadow-[0_6px_24px_rgba(201,149,60,0.45)] hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200"
        aria-label="Добавить"
      >
        <Plus size={20} />
      </button>
    </form>
  );
}
