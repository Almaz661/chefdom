import { client } from './index';

// Идемпотентный seed: если пользователи уже есть — ничего не делаем.
// Создаёт дефолтного пользователя «Семья» с PIN 1234.
export async function runSeed(): Promise<void> {
  const existing = await client<{ id: number }[]>`SELECT id FROM users LIMIT 1`;

  if (existing.length > 0) {
    console.log('[seed] пользователь уже есть, пропуск');
    return;
  }

  await client`
    INSERT INTO users (pin, name) VALUES ('1234', 'Семья')
  `;
  console.log('[seed] создан дефолтный пользователь: Семья (PIN 1234)');
}
