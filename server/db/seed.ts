import bcrypt from 'bcryptjs';
import { client } from './index';

// Идемпотентный seed: если пользователи уже есть — ничего не делаем.
// Создаёт дефолтного пользователя «Семья» с PIN 1234.
//
// pin_hash — bcrypt-хеш дефолтного PIN. Колонка pin (plain text) тоже
// заполняется для обратной совместимости с миграцией 018, которая
// требует pin NOT NULL. После того как pin будет дропнут в будущей
// миграции, эту строчку можно убрать.
export async function runSeed(): Promise<void> {
  const existing = await client<{ id: number }[]>`SELECT id FROM users LIMIT 1`;

  if (existing.length > 0) {
    console.log('[seed] пользователь уже есть, пропуск');
    return;
  }

  const defaultPin = '1234';
  const hash = await bcrypt.hash(defaultPin, 10);

  await client`
    INSERT INTO users (pin, pin_hash, name)
    VALUES (${defaultPin}, ${hash}, 'Семья')
  `;
  console.log('[seed] создан дефолтный пользователь: Семья (PIN 1234)');
}
