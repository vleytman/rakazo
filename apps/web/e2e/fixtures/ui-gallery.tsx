import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { UiBlock, UiNode } from "@rakazo/contracts";
import { createRoot } from "react-dom/client";
import { UiBlockView } from "../../src/components/ui-block/UiBlockView";
import "../../src/styles.css";

// Every render_ui node and its variants, one section each, for design review
// (import into a design tool with the section's data-section selector).
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") === "dark" ? "dark" : "light";
const i18n = setupI18n({ locale: "en", messages: { en: {} } });

const ui = (title: string | undefined, root: unknown): UiBlock => ({
  kind: "ui",
  title,
  root: root as UiNode,
  fallback: "",
});
const stack = (...children: unknown[]): UiNode => ({
  type: "stack",
  children: children as UiNode[],
});

const sections: Array<[string, string, UiBlock]> = [
  [
    "composite",
    "Composite answer",
    ui(
      "Ноутбуки до $1000",
      stack(
        {
          type: "stats",
          items: [
            { label: "Вариантов", value: 3 },
            { label: "Дешевле всего", value: "$849", hint: "Zenbook 14 OLED" },
            { label: "Средняя цена", value: 916, delta: -4.2 },
          ],
        },
        {
          type: "table",
          columns: [
            { key: "model", label: "Модель" },
            { key: "price", label: "Цена", format: "currency", currency: "USD" },
            { key: "battery", label: "Батарея, ч", format: "number" },
          ],
          rows: [
            { model: "MacBook Air 13 M4", price: 999, battery: 18 },
            { model: "ASUS Zenbook 14 OLED", price: 849, battery: 13 },
            { model: "Lenovo LOQ 15", price: 899, battery: 6 },
          ],
        },
        {
          type: "buttons",
          buttons: [
            { label: "Сравнить экраны", message: "x" },
            { label: "Открыть Best Buy", url: "https://www.bestbuy.com" },
          ],
        },
      ),
    ),
  ],
  [
    "stats",
    "stats",
    ui(undefined, {
      type: "stats",
      items: [
        { label: "Доход за октябрь", value: "$9 700", delta: 12.4 },
        { label: "Заказов", value: 7, delta: -8 },
        { label: "Часов", value: 142, hint: "из 160 запланированных" },
        { label: "Ставка", value: "$68/ч" },
      ],
    }),
  ],
  [
    "callouts",
    "callout · info / success / warning / danger",
    ui(
      undefined,
      stack(
        {
          type: "callout",
          tone: "info",
          title: "К сведению",
          text: "Курс обновляется раз в день по данным Банка Израиля.",
        },
        {
          type: "callout",
          tone: "success",
          title: "Готово",
          text: "Счёт отправлен клиенту, оплата ожидается до **15 ноября**.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Цены ориентировочные",
          text: "Проверены по Best Buy на 10 ноября; перед покупкой сверьте.",
        },
        {
          type: "callout",
          tone: "danger",
          title: "Не хватает данных",
          text: "Mashov не ответил, оценки за неделю не загружены.",
        },
      ),
    ),
  ],
  [
    "text",
    "heading · text · divider",
    ui(
      undefined,
      stack(
        { type: "heading", level: 1, text: "Заголовок первого уровня" },
        { type: "heading", level: 2, text: "Заголовок второго уровня" },
        { type: "heading", level: 3, text: "Заголовок третьего уровня" },
        {
          type: "text",
          text: "Обычный текст абзаца. **Жирное выделение** внутри строки.\n\nВторой абзац после пустой строки.",
        },
        { type: "divider" },
        { type: "text", tone: "muted", text: "Приглушённый текст для пояснений и источников." },
      ),
    ),
  ],
  [
    "table",
    "table · formats",
    ui("Счета за ноябрь", {
      type: "table",
      columns: [
        { key: "client", label: "Клиент" },
        { key: "amount", label: "Сумма", format: "currency", currency: "USD" },
        { key: "share", label: "Доля", format: "percent" },
        { key: "due", label: "Срок", format: "date" },
        { key: "paid", label: "Оплачен" },
        { key: "link", label: "Счёт", format: "link" },
      ],
      rows: [
        {
          client: "Veloxity",
          amount: 4200,
          share: 43.3,
          due: "2026-11-15",
          paid: true,
          link: "https://invoices.example.com/1042",
        },
        {
          client: "Everblue Care",
          amount: 2800,
          share: 28.9,
          due: "2026-11-20",
          paid: false,
          link: "https://invoices.example.com/1043",
        },
        {
          client: "The Resorts Collection",
          amount: 2700.5,
          share: 27.8,
          due: "2026-11-30",
          paid: null,
          link: null,
        },
      ],
    }),
  ],
  [
    "chart-line",
    "chart · line (2 series)",
    ui(undefined, {
      type: "chart",
      chart: "line",
      title: "Выручка по месяцам",
      unit: "$",
      x: ["май", "июн", "июл", "авг", "сен", "окт"],
      series: [
        { name: "Upwork", values: [4200, 5100, 3900, 6100, 7000, 6600] },
        { name: "Прямые", values: [1200, 900, 2100, 1800, 2400, 3100] },
      ],
    }),
  ],
  [
    "chart-bar",
    "chart · bar (grouped)",
    ui(undefined, {
      type: "chart",
      chart: "bar",
      title: "Часы по проектам",
      unit: "ч",
      x: ["Veloxity", "Everblue", "RATEM", "GovXRay"],
      series: [
        { name: "Сентябрь", values: [42, 18, 12, 30] },
        { name: "Октябрь", values: [55, 10, 24, 16] },
      ],
    }),
  ],
  [
    "chart-area",
    "chart · area",
    ui(undefined, {
      type: "chart",
      chart: "area",
      title: "Пользователи",
      x: ["пн", "вт", "ср", "чт", "пт", "сб", "вс"],
      series: [{ name: "Активные", values: [120, 160, 140, 190, 210, 90, 70] }],
    }),
  ],
  [
    "choices-multi",
    "choices · multiple + own answer",
    ui(undefined, {
      type: "choices",
      question: "Какие разделы добавить на сайт?",
      multiple: true,
      allowOther: true,
      options: [
        { label: "Портфолио" },
        { label: "Кейсы", hint: "подробные разборы 2–3 проектов" },
        { label: "Услуги и цены" },
        { label: "Отзывы" },
      ],
      submitLabel: "Отправить",
      otherPlaceholder: "Свой вариант…",
    }),
  ],
  [
    "choices-single",
    "choices · single",
    ui(undefined, {
      type: "choices",
      question: "Чем заняться вечером?",
      options: [
        { label: "Кино" },
        { label: "Прогулка у моря", hint: "Бат-Галим, закат в 16:45" },
        { label: "Настолки" },
        { label: "Отдохнуть дома" },
      ],
      submitLabel: "Выбрать",
    }),
  ],
  [
    "buttons",
    "buttons · primary / secondary / link",
    ui(undefined, {
      type: "buttons",
      buttons: [
        { label: "Сделать коммит", message: "x", variant: "primary" },
        { label: "Доработать", message: "x", variant: "secondary" },
        { label: "Открыть PR", url: "https://github.com" },
      ],
    }),
  ],
  [
    "columns",
    "columns · stats + chart",
    ui("Октябрь", {
      type: "columns",
      children: [
        stack(
          { type: "heading", level: 3, text: "Плюсы" },
          { type: "text", text: "Больше заказов от прямых клиентов.\n\nСтавка выросла до $68/ч." },
        ),
        stack(
          { type: "heading", level: 3, text: "Минусы" },
          { type: "text", text: "Upwork просел на 6%.\n\nДва счёта ещё не оплачены." },
        ),
      ],
    }),
  ],
];

createRoot(document.getElementById("root")!).render(
  <I18nProvider i18n={i18n}>
    <main className="min-h-screen bg-background px-6 py-6 text-foreground">
      <div className="flex w-[760px] flex-col gap-8">
        {sections.map(([id, label, block]) => (
          <section key={id} data-section={id} className="flex flex-col gap-2">
            <div className="font-mono text-body-sm text-muted-foreground">{label}</div>
            <UiBlockView block={block} target={{ botId: "bot_fixture" }} />
          </section>
        ))}
      </div>
    </main>
  </I18nProvider>,
);
