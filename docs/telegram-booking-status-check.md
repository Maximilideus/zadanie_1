# Проверка статусов бронирований в Telegram-боте

## Что проверяем

- В боте отображаются актуальные статусы: **PENDING** → **CONFIRMED** / **CANCELLED** → **COMPLETED** / **CANCELLED**.
- Переходы статусов на бэкенде соответствуют машине состояний.

---

## 1. Проверка через бота (ручной сценарий)

**Запуск:** бэкенд (`npm run dev` в `backend`), бот (`npm run dev` в `telegram-bot`), БД.

1. **Создать бронь**
   - В Telegram: `/start` → `/consult` → `/book`.
   - Бэкенд создаёт бронь со статусом `PENDING`, состояние пользователя — `BOOKING_FLOW`.

2. **Увидеть PENDING в боте**
   - `/my_bookings` — в списке одна запись, **Статус: PENDING**.

3. **Поменять статус через API** (эмуляция действий оператора/системы):
   - Узнать `bookingId` из ответа бэкенда или из сообщения бота (если выведете ID), либо запросом:
     ```bash
     curl -s "http://localhost:3000/bookings/user/YOUR_TELEGRAM_ID" | jq
     ```
   - Подставить `BOOKING_ID` и выполнить один из запросов:
     ```bash
     # Подтвердить
     curl -X PATCH "http://localhost:3000/bookings/BOOKING_ID/status" \
       -H "Content-Type: application/json" -d "{\"status\":\"CONFIRMED\"}"

     # Отменить
     curl -X PATCH "http://localhost:3000/bookings/BOOKING_ID/status" \
       -H "Content-Type: application/json" -d "{\"status\":\"CANCELLED\"}"

     # Завершить (только из CONFIRMED)
     curl -X PATCH "http://localhost:3000/bookings/BOOKING_ID/status" \
       -H "Content-Type: application/json" -d "{\"status\":\"COMPLETED\"}"
     ```

4. **Проверить отображение в боте**
   - Снова `/my_bookings` — статус должен совпадать с тем, что вы выставили (CONFIRMED / CANCELLED / COMPLETED).

5. **Повторная бронь**
   - После CANCELLED или COMPLETED снова: `/consult` → `/book` — должна создаться новая бронь с PENDING.
   - При активной брони (PENDING или CONFIRMED) повторный `/book` — сообщение «У вас уже есть активная запись» и переход в BOOKING_FLOW без новой брони.

Так вы проверяете, что статусы в боте соответствуют бэкенду и что переходы (PENDING → CONFIRMED/CANCELLED, CONFIRMED → COMPLETED/CANCELLED) работают.

---

## 2. Проверка только API (без бота)

Можно гонять сценарий только запросами к бэкенду.

1. Создать пользователя (или использовать существующий `telegramId`):
   ```bash
   curl -X POST "http://localhost:3000/telegram/auth" \
     -H "Content-Type: application/json" \
     -d "{\"telegramId\":\"123456789\",\"name\":\"Test\"}"
   ```

2. Создать бронь:
   ```bash
   curl -X POST "http://localhost:3000/telegram/bookings" \
     -H "Content-Type: application/json" \
     -d "{\"telegramId\":\"123456789\"}"
   ```
   В ответе — `id` брони и `status: "PENDING"`.

3. Список броней по `telegramId`:
   ```bash
   curl -s "http://localhost:3000/bookings/user/123456789" | jq
   ```
   Все брони должны быть с ожидаемыми статусами.

4. Менять статус через `PATCH /bookings/:id/status` (примеры выше) и снова вызывать `GET /bookings/user/123456789` — убедиться, что статусы обновляются и не допускаются неверные переходы (бэкенд вернёт 400 при нарушении машины состояний).

---

## 3. Невалидные переходы (опционально)

Убедиться, что бэкенд отклоняет запрещённые переходы (400):

- Из **COMPLETED** или **CANCELLED** в любой другой статус — ошибка.
- Из **PENDING** в **COMPLETED** — ошибка.
- Из **CONFIRMED** в **PENDING** — ошибка.

Пример:
```bash
# Создать бронь, отменить её, попытаться снова перевести в CONFIRMED
curl -X PATCH "http://localhost:3000/bookings/CANCELLED_BOOKING_ID/status" \
  -H "Content-Type: application/json" -d "{\"status\":\"CONFIRMED\"}"
# Ожидается 400 Bad Request, сообщение про invalid booking status transition.
```

---

## Краткий чеклист

| Действие | Где смотреть | Ожидание |
|----------|----------------|----------|
| `/start` → `/consult` → `/book` | `/my_bookings` | Одна запись, **PENDING** |
| PATCH статус на CONFIRMED | `/my_bookings` | **CONFIRMED** |
| PATCH статус на CANCELLED или COMPLETED | `/my_bookings` | **CANCELLED** / **COMPLETED** |
| Повторный `/book` при активной брони | Ответ бота | «У вас уже есть активная запись» |
| Повторный `/book` после CANCELLED/COMPLETED | `/my_bookings` | Новая запись с **PENDING** |

Если все пункты совпадают с ожиданием, статусы в ТГ-боте работают адекватно.
