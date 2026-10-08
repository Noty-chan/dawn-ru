# Ревью числового ввода ручного стола · 08.10.2026

База ревью: `3c981de` (`origin/codex/manual-table-continuation-20261008`).
Рабочая ветка: `codex/manual-table-review-20261008`. Продолжение предыдущего стека; main и живой Supabase не изменялись.

## Подтверждённые ошибки и исправления

- HP/counter: отметка отправки терялась при замене input через innerHTML. Fresh DOM + последующий focusout повторяли pending команду. Теперь черновик и receipt переносятся только в подходящий editable control того же actor/ability/scope.
- HP/counter: отказ писателя ошибочно считался успешной отправкой. Теперь falsy writer result освобождает черновик; точечные rejected clientIntentId / authority eventId освобождают только соответствующий input. Ошибка/повтор сетевого такта с retained queue не выдаются за отказ команды.
- Часы: change/Enter и blur могли отправлять одно значение дважды. При полном rebuild после появления других часов браузер мог также записать неотправленный черновик. Painting guard закрывает browser-generated events, same-clock draft/receipt/focus сохраняется после безопасного rebuild. Пустая строка не означает ноль. Save не пересоздаёт controls на blur: Tab доходит до следующей кнопки.
- Inspector ресурсов: замена focused dirty input записывала значение. Painting guard, same actor/scope/permission draft restore и explicit focusout обеспечивают одну запись. Числовые правки проходят typed table.command, а не legacy mutation.

## Проверки

- `node apps/companion/tests/table-manual-workspace.mjs`: fresh DOM nodes, сохранение pending marker, новый value, scope reset, synchronous refusal, matching/unrelated player и authority rejection PASS.
- `node apps/companion/tests/table-manual-clock-route.mjs`: реальные renderer/listeners с задержанным писателем, other-clock rebuild, change/blur, сохранение черновика и receipt, отказ/retry, blank PASS.
- `node apps/companion/tests/table-manual-surfaces.mjs`: реальные renderer/document handlers, injected native change/focusout при repaint, restore/one-send/epoch/refusal PASS.
- Native IAB, isolated localhost18815: production workspace + mock delayed writer: HP send1→repaint→Tab1→reject→Tab2; counter send3→repaint→Tab3→reject→Tab4. Канон HP7/counter2/version4 неизменен. Это проверка настоящего DOM/browser с mock writer, не два реальных клиента.
- Native IAB, extracted production integration functions + mock delayed writer: clock dirty2 + new clock → send0/draft2; Enter→send1; repaint/Tab→send1 и focus на Delete. Inspector dirtyHP5/repaint→send1 (предыдущие часы); Tab→2; repaint/Tab→2; exact reject/Tab→3. Канон HP7/clock0 неизменен.
- Local full app: ручной Убийца добавлен без deployment пассива; HP18→15 через footer, профиль читается полностью. Подробный shared RLS/Realtime gate не запускался.
- Первый full receipt `output/manual-input-review-final-20261008-test.log` FAIL: stale S00 inventory. Штатный `node apps/companion/tests/lionwing-enemy-inventory.mjs --write` добавил только пять ссылок на clock suite; canonical rules/статусы не менялись.
- Финальный full `npm test`: `output/manual-input-review-final2-20261008-test.log`, session33980, PASS exit0. Исполняемый пакет и тесты не изменялись во время этого прогона; затем добавлена только документация.

QA HTML/JS/cache-busters и receipts в output игнорируются Git и не являются production кодом. Скриншоты локальные: `manual-input-pending-review-20261008.jpg`, `manual-clocks-inspector-review-20261008.jpg`.

## Далее

Readonly low reviewer подтвердил ещё один presentation lifecycle defect: pointercancel не отменяет line draft, stray pointerup публикует старый жест. Нужны pointercancel/blur/hidden cleanup, отдельные actual-listener tests и native Space-pan при активном показе. Исправить следующим пакетом.

Действующий полный backlog — TABLE_TOOLS_PLAN_2026-10-07, FINAL_HANDOFF_2026-10-08. Start-rules initializer и private ephemeral transport остаются отдельными незавершёнными gates. SQL001 не применён. MVP/main не объявлять по mock-transport тестам.
