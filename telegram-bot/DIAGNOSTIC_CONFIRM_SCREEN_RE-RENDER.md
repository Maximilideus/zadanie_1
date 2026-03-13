# Diagnostic Report: Confirmation Screen Implementation and Re-render After Contact

**Scope:** Read-only diagnostic. No code changes.

**Goal:** Understand how the confirmation screen is rendered and whether it can be re-rendered (e.g. at the bottom of the chat) after the user sends their phone contact.

---

## A. Where the confirmation screen is implemented

The confirmation screen is implemented in **one place**:

- **File:** `telegram-bot/src/handlers/bookingFlow.ts`
- **Main function:** `showConfirmScreen(ctx, telegramId, scheduledAtIso)` (lines 1013–1019, exported for the contact handler).
- **Supporting functions in the same file:**
  - **`buildConfirmText(session)`** (960–966) — builds the confirmation message text from session.
  - **`buildConfirmKeyboard(scheduledAtIso)`** (969–979) — builds the inline keyboard with "✅ Подтвердить запись" and edit/cancel buttons.
  - **`editWizardMessage(ctx, session, text, keyboard)`** (483–516) — performs the actual send/edit of the wizard step message (used by `showConfirmScreen`).

**Flow:** `showConfirmScreen` loads session via `getBookingSession(telegramId)`, builds text with `buildConfirmText(session)`, builds keyboard with `buildConfirmKeyboard(scheduledAtIso)`, then calls `editWizardMessage(ctx, session, text, keyboard)`. So the **rendering** is the combination of `buildConfirmText` + `buildConfirmKeyboard`; the **delivery** is always through `editWizardMessage`.

---

## B. Functions responsible for rendering confirm UI

| Function | File | Role |
|----------|------|------|
| **showConfirmScreen** | bookingFlow.ts (1014–1019) | Entry point: gets session, builds text and keyboard, calls editWizardMessage. |
| **buildConfirmText** | bookingFlow.ts (960–966) | Builds "Проверьте данные записи" + booking card (via sessionToCardParts → formatBookingCardFromParts) + optional price line + footer lines. |
| **buildConfirmKeyboard** | bookingFlow.ts (969–979) | Builds InlineKeyboard: "✅ Подтвердить запись" (`confirm:${scheduledAtIso}`), "🕒 Другое время", "📅 Другая дата", "👩 Другой мастер", "🔄 Другая услуга", "❌ Отмена". |
| **sessionToCardParts** | bookingFlow.ts (227–238) | Maps session to card parts (serviceName, zone, durationMin, masterName, date, time, etc.). |
| **formatBookingCardFromParts** | formatters.ts (135–…) | Formats card parts into the final card string. |
| **editWizardMessage** | bookingFlow.ts (483–516) | If `session.wizardMessageId` exists: edits that message with `ctx.api.editMessageText(w.chatId, w.messageId, text, { reply_markup: keyboard })`. If edit fails: sends new message and updates session.wizardMessageId. If no wizardMessageId: sends new message and sets session.wizardMessageId. |

So the **confirm UI** is: the text from `buildConfirmText(session)` and the inline keyboard from `buildConfirmKeyboard(scheduledAtIso)`. The **only** way it is currently shown is via `editWizardMessage`, which either edits the last wizard message or sends a new one and stores its id.

---

## C. Contact request logic

- **Where:** `telegram-bot/src/handlers/bookingFlow.ts`
- **Trigger:** When the user has chosen a time slot (regular path: `onTimeSlotChosen`) or nearest slot (`onNearestSlotChosen`), and `checkCustomerHasPhone(telegramId)` returns false.
- **Code (same in both handlers):**
  - `setBookingSession(telegramId, { awaitingContact: true })`
  - `Keyboard().requestContact("📱 Поделиться номером").resized()`
  - `await ctx.reply(PHONE_REQUEST_MESSAGE, { reply_markup: contactKeyboard })`
- **Session flag:** `awaitingContact: true`. No other helper wraps the contact button; it is built inline with grammY’s `Keyboard().requestContact(...)`.
- **Message:** The contact request is always sent as a **new** message (`ctx.reply`), so it appears below the last wizard message (time slots or nearest-slot screen).

---

## D. Contact message handler behaviour

- **Handler:** `bot.on("message:contact", async (ctx) => { ... })` in **`telegram-bot/src/bot.ts`** (lines 842–863).
- **Conditions:** Session must have `awaitingContact` and `serviceId`, `masterId`, `dateStr`, `scheduledAtIso`; contact must have a non-empty `phone_number`.
- **Actions:**
  1. `setBookingSession(from.id, { phone: phone.trim(), awaitingContact: false })`
  2. `await ctx.reply("Спасибо!", { reply_markup: { remove_keyboard: true } })`
  3. `await showConfirmScreen(ctx, from.id, session.scheduledAtIso)`
- **Effect:** The bot **does** trigger confirmation rendering: it calls `showConfirmScreen`. So the confirm UI **is** shown after contact. However, `showConfirmScreen` uses `editWizardMessage`, which edits the message stored in `session.wizardMessageId`. That message is the **previous** wizard step (time-slot or nearest-slot screen), which is **above** the contact request and "Спасибо!" messages. So the confirm appears **in place of** that older message, not as a new message at the bottom. The user must scroll up to see the confirm and press "✅ Подтвердить запись".

---

## E. Session data required for confirm rendering

**From `buildConfirmText` and `sessionToCardParts` (and `buildConfirmKeyboard`):**

- **Required for text/card:**  
  `serviceName`, `masterName`, `dateStr`, `timeStr` (or equivalent for card); optionally `price`, `durationMin`, `category`, `catalogGroupKey`, `catalogElectroZone`, `catalogTitle` (for electro/zone display).
- **Required for keyboard:**  
  `scheduledAtIso` (for `confirm:${scheduledAtIso}` and edit buttons).
- **Already in session when contact is requested:**  
  Before asking for contact, both `onTimeSlotChosen` and `onNearestSlotChosen` set `dateStr`, `timeStr`, `scheduledAtIso`, `step`, `confirm`. Earlier steps have set `serviceId`, `serviceName`, `masterId`, `masterName`, and optionally `price`, `durationMin`, `category`, `catalogTitle`, `catalogGroupKey`, `catalogElectroZone`.
- **After contact:** The contact handler only updates `phone` and `awaitingContact: false`. It does **not** clear or overwrite any of the above. So **all session data needed to render the confirm screen is still present** when the contact handler runs. Re-rendering the same confirm UI is safe from a session-data perspective.

---

## F. Whether confirm screen can be safely re-rendered after contact

**Yes, it is technically safe** to call the same confirmation rendering logic after the user sends contact:

1. **Session state:** Sufficient. All fields required by `buildConfirmText` and `buildConfirmKeyboard` remain in session; nothing is cleared except `awaitingContact` and the added `phone`.
2. **Message ID dependency:** The **current** implementation always goes through `editWizardMessage`, which uses `session.wizardMessageId`. That still points to the **time-slot or nearest-slot** message. So when the contact handler calls `showConfirmScreen`, the confirm is drawn by **editing that older message**. That does not break anything (edit succeeds), but it is why the confirm appears above the "Спасибо!" message.
3. **Re-rendering "at the bottom":** To show the confirm at the bottom of the chat, the same **content** (text + keyboard) can be sent as a **new** message (e.g. `ctx.reply(text, { reply_markup: keyboard })`) instead of editing the old wizard message. That would:
   - Be safe: same session, same buildConfirmText/buildConfirmKeyboard.
   - Require a small change: either a separate path in the contact handler that sends a new message with confirm content, or a parameter/option on `showConfirmScreen` (or a thin wrapper) to "send as new message" and optionally update `session.wizardMessageId` so that later actions (edit_time, edit_date, etc.) target the new message. No change to database, API, or session shape is required.

**Summary:** The confirm screen **can** be safely re-rendered after contact. The only behavioural choice is **where** it appears: current behaviour is "edit previous wizard message"; to get it at the bottom, send the same text and keyboard as a new message and optionally treat that as the new wizard message for subsequent edits.

---

## G. Recommended safe integration point for re-rendering confirm

- **Where:** In the **contact handler** in **`telegram-bot/src/bot.ts`** (after storing phone and sending "Спасибо!"), when calling the logic that shows the confirm screen.
- **What to change (conceptually):** Instead of calling `showConfirmScreen(ctx, from.id, session.scheduledAtIso)` (which edits the old wizard message), send the **same** confirm content as a **new** message at the bottom of the chat. Options:
  - **Option A:** In the contact handler only: build the same text and keyboard (using the same helpers from bookingFlow, or a small exported helper that returns `{ text, keyboard }`), then `ctx.reply(text, { reply_markup: keyboard })`, and optionally update `session.wizardMessageId` to this new message so that "Другое время" / "Другая дата" etc. edit this message.
  - **Option B:** Add a parameter to `showConfirmScreen` (e.g. `sendAsNewMessage?: boolean`). When true, use `ctx.api.sendMessage(chatId, text, { reply_markup: keyboard })` (with `chatId` from `ctx`), update `session.wizardMessageId` to the new message, and skip editing the old message. The contact handler would then call `showConfirmScreen(ctx, from.id, session.scheduledAtIso, true)` or similar.
- **Why this is safe:** Session already has all data; no new APIs or schema; confirm content is unchanged; only the **delivery** (new message vs edit) changes. Care should be taken to update `wizardMessageId` if later wizard steps (edit_time, edit_date, etc.) assume they are editing the "current" wizard message, so that those edits still work after the user has shared contact.

**End of report.**
