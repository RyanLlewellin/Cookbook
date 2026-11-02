/* Shared browser-only ingredient scaling for all generated Cookbook pages. */
(() => {
  "use strict";
  const dataElement = document.getElementById("recipe-data");
  const selector = document.getElementById("servings");
  const ingredientList = document.getElementById("ingredients");
  const scalingNote = document.getElementById("scaling-note");
  if (!dataElement || !selector || !ingredientList) return;

  let recipe;
  try {
    recipe = JSON.parse(dataElement.textContent);
  } catch (_) {
    return; // Keep the server-rendered ingredient list intact.
  }
  const slug = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = slug(recipe.category || "recipe") + "/" + slug(recipe.slug || recipe.title);
  const key = "cookbook-recipe-servings";
  function readServings() {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "{}");
      const value = Number(data[id]);
      return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
    } catch (_) { return null; }
  }
  function saveServings(value) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "{}");
      const state = data && typeof data === "object" && !Array.isArray(data) ? data : {};
      state[id] = value;
      localStorage.setItem(key, JSON.stringify(state));
    } catch (_) {}
  }
  const original = recipe.original_servings;
  if (!Number.isInteger(original) || original <= 0) {
    selector.disabled = true;
    if (scalingNote) scalingNote.textContent = "Original yield unavailable; ingredient amounts cannot be scaled reliably.";
    return;
  }

  const fractions = [
    [0, ""], [1 / 8, "⅛"], [1 / 6, "⅙"],
    [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"],
    [1 / 2, "½"], [5 / 8, "⅝"], [2 / 3, "⅔"],
    [3 / 4, "¾"], [5 / 6, "⅚"], [7 / 8, "⅞"], [1, ""]
  ];
  function formatAmount(value) {
    if (Math.abs(value - Math.round(value)) < 0.001) return String(Math.round(value));
    if (value >= 20) return String(Math.round(value * 10) / 10);
    const whole = Math.floor(value);
    const part = value - whole;
    const nearest = fractions.reduce((a, b) => Math.abs(b[0] - part) < Math.abs(a[0] - part) ? b : a);
    if (Math.abs(nearest[0] - part) < 0.025) {
      if (nearest[0] === 1) return String(whole + 1);
      return (whole ? String(whole) : "") + nearest[1];
    }
    return String(Math.round(value * 100) / 100);
  }
  function ingredientText(ingredient, selected) {
    const qty = ingredient.quantity;
    const scalable = ingredient.scalable !== false && typeof qty === "number";
    const amount = typeof qty === "number" ? formatAmount(scalable ? qty * selected / original : qty) + " " : "";
    const unit = ingredient.unit ? ingredient.unit + " " : "";
    const note = ingredient.note ? ", " + ingredient.note : "";
    return amount + unit + ingredient.name + note + (ingredient.optional ? " (optional)" : "");
  }
  function render() {
    const selected = Number(selector.value);
    if (!Number.isInteger(selected) || selected < 1 || selected > 10) return;
    ingredientList.replaceChildren();
    recipe.ingredients.forEach(item => {
      const li = document.createElement("li");
      li.textContent = ingredientText(item, selected);
      ingredientList.append(li);
    });
    const indivisible = recipe.ingredients.some(item =>
      item.scalable !== false && typeof item.quantity === "number" &&
      /^(egg|eggs)$/i.test(item.name.trim()) &&
      !Number.isInteger(item.quantity * selected / original)
    );
    if (scalingNote) {
      scalingNote.textContent = indivisible
        ? "Amounts are scaled from the original recipe. For fractional eggs, beat an egg and measure the needed portion."
        : "Amounts are scaled from the original recipe. Seasonings marked 'to taste' are unchanged.";
    }
  }
  const saved = readServings();
  if (saved && selector.querySelector('option[value="' + saved + '"]')) selector.value = String(saved);
  selector.addEventListener("change", () => {
    const value = Number(selector.value);
    if (Number.isInteger(value) && value >= 1 && value <= 10) saveServings(value);
    render();
  });
  window.addEventListener("storage", event => {
    if (event.key !== key) return;
    const updated = readServings();
    if (updated) { selector.value = String(updated); render(); }
  });
  render();
})();
