(function () {
  "use strict";

  const INVENTORY_KEY = "cookbook-kitchen-inventory-v2";
  const SNAPSHOTS_KEY = "cookbook-kitchen-snapshots-v2";
  const CUSTOM_GROCERY_KEY = "cookbook-grocery-custom-v2";
  const LEGACY_PANTRY_KEY = "cookbook-pantry";
  const MAX_SNAPSHOTS = 30;
  const units = new Set([
    "g", "kg", "oz", "lb", "lbs", "ml", "l", "cup", "cups", "tbsp", "tsp",
    "can", "cans", "jar", "jars", "bag", "bags", "box", "boxes", "bunch",
    "bunches", "pack", "packs", "dozen", "piece", "pieces",
  ]);
  const fridgeWords = [
    "milk", "cream", "yogurt", "cheese", "egg", "butter", "chicken", "beef",
    "pork", "fish", "salmon", "tofu", "lettuce", "spinach", "kale", "berry",
    "berries", "grape", "apple", "orange", "lemon", "lime", "carrot", "celery",
    "broccoli", "pepper", "cucumber", "tomato", "avocado", "herb", "cilantro",
    "parsley", "deli", "juice", "leftover",
  ];

  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const cleanName = value => String(value || "").trim().replace(/\s+/g, " ").slice(0, 100);
  const normalize = value => cleanName(value).toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const cleanUnit = value => String(value || "").trim().toLowerCase().slice(0, 24);
  const positive = (value, fallback = 1) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : fallback;
  };
  const inferLocation = name => {
    const value = normalize(name);
    return fridgeWords.some(word => value.includes(word)) ? "fridge" : "pantry";
  };
  const sanitizeItem = raw => {
    const name = cleanName(raw && raw.name);
    if (!name) return null;
    return {
      id: cleanName(raw.id) || id(),
      name,
      quantity: positive(raw.quantity),
      unit: cleanUnit(raw.unit),
      location: raw.location === "fridge" ? "fridge" : raw.location === "pantry" ? "pantry" : inferLocation(name),
      note: String(raw.note || "").trim().slice(0, 180),
      updatedAt: Number(raw.updatedAt) || Date.now(),
    };
  };
  const sortItems = items => [...items].sort((a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name));
  const fingerprint = items => JSON.stringify(sortItems(items).map(({ name, quantity, unit, location, note }) => ({ name, quantity, unit, location, note })));

  function loadInventory() {
    const stored = read(INVENTORY_KEY, null);
    if (Array.isArray(stored)) return sortItems(stored.map(sanitizeItem).filter(Boolean));
    const legacy = read(LEGACY_PANTRY_KEY, []);
    const migrated = Array.isArray(legacy) ? legacy.map(name => sanitizeItem({ name, quantity: 1, location: inferLocation(name) })).filter(Boolean) : [];
    write(INVENTORY_KEY, migrated);
    if (migrated.length) saveSnapshot(migrated, "Imported previous ingredients");
    return sortItems(migrated);
  }

  function saveSnapshot(items, label) {
    const snapshots = read(SNAPSHOTS_KEY, []);
    const nextFingerprint = fingerprint(items);
    if (snapshots[0] && snapshots[0].fingerprint === nextFingerprint) return snapshots[0];
    const snapshot = {
      id: id(),
      label: cleanName(label) || "Kitchen updated",
      createdAt: Date.now(),
      fingerprint: nextFingerprint,
      items: items.map(item => ({ ...item })),
    };
    write(SNAPSHOTS_KEY, [snapshot, ...snapshots].slice(0, MAX_SNAPSHOTS));
    return snapshot;
  }

  function saveInventory(rawItems, reason, options) {
    const items = sortItems(rawItems.map(sanitizeItem).filter(Boolean));
    write(INVENTORY_KEY, items);
    write(LEGACY_PANTRY_KEY, [...new Set(items.map(item => normalize(item.name)).filter(Boolean))]);
    if (!options || options.snapshot !== false) saveSnapshot(items, reason || "Kitchen updated");
    window.dispatchEvent(new CustomEvent("cookbook-kitchen-change", { detail: { inventory: items } }));
    return items;
  }

  function addInventoryItem(raw, reason) {
    const item = sanitizeItem(raw);
    if (!item) return loadInventory();
    const inventory = loadInventory();
    const match = inventory.find(existing => normalize(existing.name) === normalize(item.name) && existing.location === item.location && existing.unit === item.unit);
    if (match) {
      match.quantity = Math.round((match.quantity + item.quantity) * 100) / 100;
      if (item.note) match.note = item.note;
      match.updatedAt = Date.now();
    } else {
      inventory.push(item);
    }
    return saveInventory(inventory, reason || "Added " + item.name);
  }

  function updateInventoryItem(itemId, changes, reason) {
    const inventory = loadInventory();
    const index = inventory.findIndex(item => item.id === itemId);
    if (index < 0) return inventory;
    const updated = sanitizeItem({ ...inventory[index], ...changes, id: itemId, updatedAt: Date.now() });
    if (!updated) return inventory;
    inventory[index] = updated;
    return saveInventory(inventory, reason || "Updated " + updated.name);
  }

  function removeInventoryItem(itemId, reason) {
    const inventory = loadInventory();
    const removed = inventory.find(item => item.id === itemId);
    if (!removed) return inventory;
    return saveInventory(inventory.filter(item => item.id !== itemId), reason || "Used " + removed.name);
  }

  function useOne(itemId) {
    const inventory = loadInventory();
    const item = inventory.find(candidate => candidate.id === itemId);
    if (!item) return inventory;
    if (item.quantity <= 1) return removeInventoryItem(itemId, "Finished " + item.name);
    return updateInventoryItem(itemId, { quantity: Math.round((item.quantity - 1) * 100) / 100 }, "Used some " + item.name);
  }

  function replaceInventory(items, reason) {
    return saveInventory(items, reason || "Replaced kitchen inventory");
  }

  function listSnapshots() {
    const snapshots = read(SNAPSHOTS_KEY, []);
    return Array.isArray(snapshots) ? snapshots : [];
  }

  function restoreSnapshot(snapshotId) {
    const snapshot = listSnapshots().find(candidate => candidate.id === snapshotId);
    if (!snapshot || !Array.isArray(snapshot.items)) return loadInventory();
    return saveInventory(snapshot.items, "Restored " + snapshot.label);
  }

  function parseList(text) {
    return String(text || "").split(/[\n,;]+/).map(line => line.replace(/^[-*•✓\s]+/, "").trim()).filter(Boolean).slice(0, 150).map(line => {
      let location = null;
      const locationMatch = line.match(/\s*\|\s*(fridge|pantry)\s*$/i);
      if (locationMatch) {
        location = locationMatch[1].toLowerCase();
        line = line.slice(0, locationMatch.index).trim();
      }
      let quantity = 1, unit = "", name = line;
      const measured = line.match(/^(\d+(?:\.\d+)?)\s+([^\s]+)\s+(.+)$/);
      if (measured && units.has(measured[2].toLowerCase())) {
        quantity = positive(measured[1]); unit = cleanUnit(measured[2]); name = measured[3];
      } else {
        const counted = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
        if (counted) { quantity = positive(counted[1]); name = counted[2]; }
      }
      name = cleanName(name);
      return sanitizeItem({ name, quantity, unit, location: location || inferLocation(name) });
    }).filter(Boolean);
  }

  function loadCustomGroceries() {
    const items = read(CUSTOM_GROCERY_KEY, []);
    return Array.isArray(items) ? items.map(sanitizeItem).filter(Boolean) : [];
  }

  function saveCustomGroceries(items) {
    const clean = items.map(sanitizeItem).filter(Boolean);
    write(CUSTOM_GROCERY_KEY, clean);
    window.dispatchEvent(new CustomEvent("cookbook-grocery-change", { detail: { groceries: clean } }));
    return clean;
  }

  function addCustomGrocery(raw) {
    const item = sanitizeItem(raw);
    if (!item) return loadCustomGroceries();
    const items = loadCustomGroceries();
    const match = items.find(existing => normalize(existing.name) === normalize(item.name) && existing.unit === item.unit);
    if (match) {
      match.quantity = Math.round((match.quantity + item.quantity) * 100) / 100;
      match.location = item.location;
      match.updatedAt = Date.now();
    } else items.push(item);
    return saveCustomGroceries(items);
  }

  function removeCustomGrocery(itemId) {
    return saveCustomGroceries(loadCustomGroceries().filter(item => item.id !== itemId));
  }

  function putAway(items, reason) {
    let inventory = loadInventory();
    for (const raw of items) {
      const item = sanitizeItem(raw);
      if (!item) continue;
      const match = inventory.find(existing => normalize(existing.name) === normalize(item.name) && existing.location === item.location && existing.unit === item.unit);
      if (match) {
        match.quantity = Math.round((match.quantity + item.quantity) * 100) / 100;
        match.updatedAt = Date.now();
      } else inventory.push(item);
    }
    return saveInventory(inventory, reason || "Put away groceries");
  }

  function summary(items) {
    const inventory = items || loadInventory();
    const line = item => `${item.quantity}${item.unit ? " " + item.unit : ""} ${item.name}${item.note ? " — " + item.note : ""}`;
    const fridge = inventory.filter(item => item.location === "fridge").map(line);
    const pantry = inventory.filter(item => item.location === "pantry").map(line);
    return `Kitchen inventory (${new Date().toLocaleDateString()})\n\nFRIDGE\n${fridge.length ? fridge.map(value => "- " + value).join("\n") : "- Empty"}\n\nPANTRY\n${pantry.length ? pantry.map(value => "- " + value).join("\n") : "- Empty"}`;
  }

  window.CookbookKitchen = {
    normalize, inferLocation, parseList, summary,
    loadInventory, saveInventory, addInventoryItem, updateInventoryItem,
    removeInventoryItem, useOne, replaceInventory, listSnapshots, restoreSnapshot,
    loadCustomGroceries, saveCustomGroceries, addCustomGrocery, removeCustomGrocery,
    putAway,
  };
})();
