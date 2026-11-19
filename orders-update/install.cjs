const fs = require("node:fs"),
  path = require("node:path");
const root = process.cwd(),
  payload = path.join(__dirname, "payload");
const additions = [
  "src/app/orders.tsx",
  "src/components/order-ui.tsx",
  "src/components/orders-admin.tsx",
  "src/lib/orders-api.ts",
  "src/lib/order-rules.ts",
  "tests/order-rules.test.mjs",
];
const changes = new Map();
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
try {
  if (
    !fs.existsSync(path.join(root, "package.json")) ||
    !fs.existsSync(path.join(root, "src/providers/auth.tsx"))
  )
    throw Error(
      "Запустите установщик из корня BarManager, рядом с package.json.",
    );
  for (const f of additions) {
    const content = fs.readFileSync(path.join(payload, f), "utf8");
    if (fs.existsSync(path.join(root, f)) && read(f) !== content)
      throw Error(
        "Файл " +
          f +
          " уже существует и отличается. Обновление остановлено, чтобы сохранить ваши изменения.",
      );
    changes.set(f, content);
  }
  let home = read("src/app/home.tsx");
  if (!home.includes("router.push('/orders')")) {
    const anchor = "const openSection = (route: Route) => {";
    if (!home.includes(anchor))
      throw Error(
        "Не найдена точка подключения Заказа в home.tsx. Файлы не изменены.",
      );
    home = home.replace(
      anchor,
      anchor +
        "\n    if (route === 'order') { setDropdownOpen(false); router.push('/orders'); return; }",
    );
  }
  changes.set("src/app/home.tsx", home);
  let layout = read("src/app/_layout.tsx");
  if (!/<Stack.Screen\s+name=["']orders["']/.test(layout)) {
    const anchor = '<Stack.Screen name="storage" />';
    if (!layout.includes(anchor))
      throw Error(
        "Не найдена защищённая навигация в _layout.tsx. Файлы не изменены.",
      );
    layout = layout.replace(
      anchor,
      anchor + '\n      <Stack.Screen name="orders" />',
    );
  }
  changes.set("src/app/_layout.tsx", layout);
  if (fs.existsSync(path.join(root, "tests/sections.test.mjs"))) {
    changes.set("tests/sections.test.mjs", read("tests/sections.test.mjs").replaceAll("../payload/src/", "../src/"));
  }
  let model = read("src/lib/recipe-model.ts");
  if (!/source_sheet\??\s*:/.test(model)) {
    if (!model.includes("export type Recipe = {"))
      throw Error("Не найдена модель Recipe.");
    model = model.replace(
      "export type Recipe = {",
      "export type Recipe = {\n  source_sheet?: string | null;",
    );
  }
  model = model.replace(
    "category: { name: string | null }",
    "category: { name: string | null; sort_order?: number | null }",
  );
  changes.set("src/lib/recipe-model.ts", model);
  for (const [f, content] of changes)
    if (fs.existsSync(path.join(root, f)) && read(f) === content)
      changes.delete(f);
  if (!changes.size) {
    console.log("Обновление уже установлено.");
    process.exit(0);
  }
  const backup = path.join(
    root,
    "orders-update-backups",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  const originals = new Map();
  for (const [f] of changes) {
    const full = path.join(root, f);
    const old = fs.existsSync(full) ? fs.readFileSync(full) : null;
    originals.set(f, old);
    if (old) {
      const to = path.join(backup, f + ".bak");
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, old);
    }
  }
  try {
    for (const [f, content] of changes) {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), content);
    }
  } catch (error) {
    for (const [f, old] of originals) {
      if (old) fs.writeFileSync(path.join(root, f), old);
      else fs.rmSync(path.join(root, f), { force: true });
    }
    throw error;
  }
  console.log("Готово: раздел заказов подключён. Резервные копии: " + backup);
  console.log(
    "Далее выполните SQL-файлы 01–06 в Supabase, проверьте приложение и пересоберите APK.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
