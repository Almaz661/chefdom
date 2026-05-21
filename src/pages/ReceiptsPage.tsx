import { Receipt } from "lucide-react";

export function ReceiptsPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8">
      <h1 className="font-serif text-2xl lg:text-3xl font-semibold text-ink mb-6">
        Чеки
      </h1>
      <div className="bg-paper border border-line border-dashed rounded-2xl p-12 text-center">
        <Receipt size={40} className="text-line-strong mx-auto mb-4" strokeWidth={1.5} />
        <p className="font-serif text-lg text-ink mb-2">Чеки появятся здесь</p>
        <p className="text-ink-soft text-sm">
          Сканирование чеков будет доступно в Этапе E
        </p>
      </div>
    </div>
  );
}
