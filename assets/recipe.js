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
  const canScale = Number.isInteger(original) && original > 0;
  if (!canScale) {
    selector.disabled = true;
    if (scalingNote) scalingNote.textContent = "Original yield unavailable; ingredient amounts cannot be scaled reliably.";
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
  const kitchen = window.CookbookKitchen;
  const addMissing = document.getElementById("add-missing");
  const feedback = document.getElementById("ingredient-feedback");
  const units = {
    g: ["weight", 1], kg: ["weight", 1000], oz: ["weight", 28.349523125],
    lb: ["weight", 453.59237], ml: ["volume", 1], l: ["volume", 1000],
    cup: ["volume", 236.588], tbsp: ["volume", 14.78675],
    tsp: ["volume", 4.9289167], "fl oz": ["volume", 29.5735],
    "": ["count", 1], piece: ["count", 1], dozen: ["count", 12],
  };
  function unitKey(unit) {
    const key = String(unit || "").toLowerCase().trim().replace(/\./g, "");
    const aliases = { grams: "g", gram: "g", ounces: "oz", ounce: "oz",
      pounds: "lb", pound: "lb", lbs: "lb", tablespoons: "tbsp", tablespoon: "tbsp",
      teaspoons: "tsp", teaspoon: "tsp", milliliters: "ml", liters: "l" };
    return Object.hasOwn(aliases, key) ? aliases[key] : key.replace(/s$/, "");
  }
  function amountNeeded(item, selected) {
    if (typeof item.quantity !== "number") return null;
    return canScale && item.scalable !== false ? item.quantity * selected / original : item.quantity;
  }
  function ingredientKey(name) {
    const key = kitchen.normalize(name.split(",")[0]).replace(/\b(eggs|onions|tomatoes|potatoes|peppers)\b/g,
      word => ({ eggs: "egg", onions: "onion", tomatoes: "tomato", potatoes: "potato", peppers: "pepper" })[word]);
    const aliases = { "parmesan cheese": "parmesan", "all purpose flour": "flour", "corn starch": "cornstarch" };
    return Object.hasOwn(aliases, key) ? aliases[key] : key;
  }
  function availability(item, selected, inventory) {
    const matches = inventory.filter(entry => ingredientKey(entry.name) === ingredientKey(item.name));
    const needed = amountNeeded(item, selected);
    const key = unitKey(item.unit);
    const target = Object.hasOwn(units, key) ? units[key] : null;
    let comparable = false;
    const available = matches.reduce((total, entry) => {
      const sourceKey = unitKey(entry.unit);
      const source = Object.hasOwn(units, sourceKey) ? units[sourceKey] : null;
      if (sourceKey === key) { comparable = true; return total + entry.quantity; }
      if (source && target && source[0] === target[0]) {
        comparable = true;
        return total + entry.quantity * source[1] / target[1];
      }
      return total;
    }, 0);
    const enough = matches.length > 0 && (needed === null || available + 0.000001 >= needed);
    const label = enough ? "In storage" : !matches.length ? "Missing" :
      comparable ? "Not enough in storage" : "Amount in storage can’t be compared";
    return { matches, needed, available, enough, label };
  }
  function addGroceries(entries) {
    const groceries = kitchen.loadCustomGroceries();
    for (const { item, state } of entries) {
      const quantity = state.needed === null ? 1 :
        Math.max(0.01, Math.ceil((state.enough ? state.needed : state.needed - state.available) * 100 - 0.000001) / 100);
      const existing = groceries.find(entry => ingredientKey(entry.name) === ingredientKey(item.name) &&
        unitKey(entry.unit) === unitKey(item.unit));
      if (existing) existing.quantity = Math.max(existing.quantity, quantity);
      else groceries.push({ name: item.name, quantity, unit: item.unit, location: kitchen.inferLocation(item.name) });
    }
    kitchen.saveCustomGroceries(groceries);
    feedback.textContent = entries.length === 1 ? "Ingredient on grocery list." : entries.length + " ingredients on grocery list.";
  }
  function ingredientText(ingredient, selected) {
    const qty = ingredient.quantity;
    const amount = typeof qty === "number" ? formatAmount(amountNeeded(ingredient, selected)) + " " : "";
    const unit = ingredient.unit ? ingredient.unit + " " : "";
    const note = ingredient.note ? ", " + ingredient.note : "";
    return amount + unit + ingredient.name + note + (ingredient.optional ? " (optional)" : "");
  }
  function render() {
    const selected = canScale ? Number(selector.value) : 1;
    if (!Number.isInteger(selected) || selected < 1 || selected > 10) return;
    ingredientList.replaceChildren();
    const inventory = kitchen ? kitchen.loadInventory() : [];
    const missing = [];
    recipe.ingredients.forEach(item => {
      const li = document.createElement("li");
      li.textContent = ingredientText(item, selected);
      if (kitchen) {
        const state = availability(item, selected, inventory);
        li.classList.add(state.enough ? "ingredient-have" : "ingredient-missing");
        const status = document.createElement("span");
        status.className = "ingredient-status";
        status.textContent = state.label;
        li.append(status);
        if (!state.enough) missing.push({ item, state });
        const actions = document.createElement("div");
        actions.className = "ingredient-actions";
        function button(label, accessibleLabel, action) {
          const control = document.createElement("button");
          control.type = "button";
          control.textContent = label;
          control.setAttribute("aria-label", accessibleLabel + " " + item.name);
          control.title = accessibleLabel + " " + item.name;
          control.onclick = action;
          actions.append(control);
          return control;
        }
        button("+ Grocery", "Add to grocery list", () => addGroceries([{ item, state }]));
        const storageLabel = document.createElement("label");
        const storageCheck = document.createElement("input");
        storageCheck.type = "checkbox";
        storageCheck.checked = state.enough;
        storageCheck.disabled = state.enough;
        storageCheck.setAttribute("aria-label", "Mark enough in storage for this recipe: " + item.name);
        storageCheck.onchange = () => {
          const quantity = Math.max(0.01, Math.ceil(((state.needed ?? 1) - state.available) * 100 - 0.000001) / 100);
          kitchen.addInventoryItem({ name: item.name, unit: item.unit, quantity,
            location: state.matches[0]?.location ?? kitchen.inferLocation(item.name) });
          render();
          feedback.textContent = item.name + " updated in storage.";
        };
        storageLabel.append(storageCheck, " In storage");
        actions.append(storageLabel);
        button("×", "Remove from storage:", () => {
          const ids = new Set(state.matches.map(entry => entry.id));
          kitchen.saveInventory(inventory.filter(entry => !ids.has(entry.id)), "Removed " + item.name);
          render();
          feedback.textContent = item.name + " removed from storage.";
        }).disabled = !state.matches.length;
        li.append(actions);
      }
      ingredientList.append(li);
    });
    if (kitchen && addMissing) {
      addMissing.hidden = false;
      addMissing.disabled = !missing.length;
      addMissing.onclick = () => addGroceries(missing);
    }
    const indivisible = canScale && recipe.ingredients.some(item =>
      item.scalable !== false && typeof item.quantity === "number" &&
      /^(egg|eggs)$/i.test(item.name.trim()) &&
      !Number.isInteger(item.quantity * selected / original)
    );
    if (canScale && scalingNote) {
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
    if (event.key === key) {
      const updated = readServings();
      if (updated) selector.value = String(updated);
    }
    render();
  });
  window.addEventListener("pageshow", render);
  render();
})();
