import { setupI18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { UiBlock } from "@rakazo/contracts";
import { createRoot } from "react-dom/client";
import { UiBlockView } from "../../src/components/ui-block/UiBlockView";
import "../../src/styles.css";

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") === "dark" ? "dark" : "light";
const i18n = setupI18n({ locale: "ru", messages: { ru: {} } });

const block: UiBlock = {
  kind: "ui",
  title: "Ноутбуки до $1000",
  fallback: "Ноутбуки до $1000: MacBook Air M4 — $999; Zenbook 14 — $849; Lenovo LOQ 15 — $899.",
  root: {
    type: "stack",
    children: [
      {
        type: "stats",
        items: [
          { label: "Вариантов", value: 3 },
          { label: "Дешевле всего", value: "$849", hint: "Zenbook 14 OLED" },
          { label: "Средняя цена", value: 916, delta: -4.2 },
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Цены ориентировочные",
        text: "Проверены по Best Buy на **10 ноября**; перед покупкой сверьте.",
      },
      {
        type: "columns",
        children: [
          {
            type: "table",
            columns: [
              { key: "model", label: "Модель" },
              { key: "price", label: "Цена", format: "currency", currency: "USD" },
              { key: "ram", label: "Память" },
              { key: "url", label: "Ссылка", format: "link" },
            ],
            rows: [
              { model: "MacBook Air 13 M4", price: 999, ram: "16 ГБ", url: "https://www.apple.com/macbook-air/" },
              { model: "ASUS Zenbook 14 OLED", price: 849, ram: "16 ГБ", url: "https://www.asus.com" },
              { model: "Lenovo LOQ 15", price: 899, ram: "16 ГБ", url: "https://www.lenovo.com" },
            ],
          },
          {
            type: "chart",
            chart: "bar",
            title: "Автономность, часов",
            x: ["MacBook", "Zenbook", "LOQ"],
            series: [{ name: "Часы", values: [18, 13, 6] }],
            unit: "ч",
          },
        ],
      },
      {
        type: "chart",
        chart: "line",
        title: "Цена за полгода",
        x: ["май", "июн", "июл", "авг", "сен", "окт"],
        series: [
          { name: "MacBook", values: [1099, 1099, 999, 999, 949, 999] },
          { name: "Zenbook", values: [949, 899, 899, 849, 849, 849] },
        ],
        unit: "$",
      },
      {
        type: "choices",
        question: "Что для вас важнее?",
        options: [{ label: "Автономность" }, { label: "Цена", hint: "до $900" }, { label: "Игры" }],
        multiple: true,
        allowOther: true,
      },
      {
        type: "buttons",
        buttons: [
          { label: "Сравнить экраны", message: "Сравни экраны этих ноутбуков" },
          { label: "Открыть Best Buy", url: "https://www.bestbuy.com" },
        ],
      },
    ],
  },
};

createRoot(document.getElementById("root")!).render(
  <I18nProvider i18n={i18n}>
    <main className="min-h-screen bg-background px-4 py-5 text-foreground md:px-7 md:py-6">
      <UiBlockView block={block} target={{ botId: "bot_fixture" }} />
    </main>
  </I18nProvider>,
);
