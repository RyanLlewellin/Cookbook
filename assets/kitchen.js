(function () {
  "use strict";

  const INVENTORY_KEY = "cookbook-kitchen-inventory-v2";
  const SNAPSHOTS_KEY = "cookbook-kitchen-snapshots-v2";
  const CUSTOM_GROCERY_KEY = "cookbook-grocery-custom-v2";
  const LEGACY_PANTRY_KEY = "cookbook-pantry";
  const MAX_SNAPSHOTS = 30;
  const units = new Set([
    "g", "kg", "oz", "lb", "lbs", "ml", "l", "cup", "cups", "tbsp", "tsp",
    "can", "cans", "jar", "jars", "bag", "bags", "box", "boxes", "bottle",
    "bottles", "package", "packages", "carton", "cartons", "canister", "canisters",
    "loaf", "loaves", "ear", "ears", "stick", "sticks", "bunch", "bunches",
    "pack", "packs", "packet", "packets", "dozen", "piece", "pieces",
  ]);
  const freezerWords = ["frozen", "freezer", "ice cream", "popsicle"];
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
    return freezerWords.some(word => value.includes(word)) ? "freezer" : fridgeWords.some(word => value.includes(word)) ? "fridge" : "pantry";
  };
  const sanitizeItem = raw => {
    let name = cleanName(raw && raw.name);
    if (!name) return null;
    let unit = cleanUnit(raw.unit);
    const legacyContainer = !unit && name.match(/^(carton|canister)\s+(.+)$/i);
    if (legacyContainer) { unit = legacyContainer[1].toLowerCase(); name = cleanName(legacyContainer[2]); }
    return {
      id: cleanName(raw.id) || id(),
      name,
      quantity: positive(raw.quantity),
      unit,
      location: ["fridge", "freezer", "pantry"].includes(raw.location) ? raw.location : inferLocation(name),
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

  function exportInventory() {
    return JSON.stringify({
      format: "cookbook-inventory",
      version: 1,
      items: loadInventory(),
      snapshots: listSnapshots(),
    }, null, 2);
  }

  function importInventory(backup) {
    const invalid = () => new Error("Choose a valid Cookbook inventory backup.");
    function validateItems(items) {
      if (!Array.isArray(items)) throw invalid();
      return items.map(item => {
        if (!item || typeof item.name !== "string" || !item.name.trim() ||
            !Number.isFinite(item.quantity) || item.quantity <= 0 ||
            !["fridge", "freezer", "pantry"].includes(item.location)) throw invalid();
        return sanitizeItem({ ...item, id: id() });
      });
    }
    if (backup?.format !== "cookbook-inventory" || backup.version !== 1 ||
        !Array.isArray(backup.snapshots)) throw invalid();
    const items = sortItems(validateItems(backup.items));
    const snapshots = backup.snapshots.slice(0, MAX_SNAPSHOTS).map(snapshot => {
      if (!snapshot || typeof snapshot.label !== "string" ||
          !Number.isFinite(snapshot.createdAt)) throw invalid();
      const items = validateItems(snapshot.items);
      return { id: id(), label: cleanName(snapshot.label), createdAt: snapshot.createdAt, items, fingerprint: fingerprint(items) };
    });
    const current = loadInventory();
    if (current.length && fingerprint(current) !== fingerprint(items)) {
      snapshots.unshift({ id: id(), label: "Before inventory import", createdAt: Date.now(), items: current, fingerprint: fingerprint(current) });
    }
    const updates = [
      [SNAPSHOTS_KEY, snapshots.slice(0, MAX_SNAPSHOTS)],
      [INVENTORY_KEY, items],
      [LEGACY_PANTRY_KEY, [...new Set(items.map(item => normalize(item.name)).filter(Boolean))]],
    ];
    const written = [];
    try {
      for (const [key, value] of updates) {
        const previous = localStorage.getItem(key);
        localStorage.setItem(key, JSON.stringify(value));
        written.push([key, previous]);
      }
    } catch (error) {
      for (const [key, previous] of written.reverse()) {
        if (previous === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previous);
      }
      throw error;
    }
    return items.length;
  }

  function parseList(text) {
    return String(text || "").split(/[\n,;]+/).map(line => line.replace(/^[-*•✓\s]+/, "").trim()).filter(Boolean).slice(0, 150).map(line => {
      let location = null;
      const locationMatch = line.match(/\s*\|\s*(fridge|freezer|pantry)\s*$/i);
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
    const freezer = inventory.filter(item => item.location === "freezer").map(line);
    const pantry = inventory.filter(item => item.location === "pantry").map(line);
    return `Kitchen inventory (${new Date().toLocaleDateString()})\n\nFRIDGE\n${fridge.length ? fridge.map(value => "- " + value).join("\n") : "- Empty"}\n\nFREEZER\n${freezer.length ? freezer.map(value => "- " + value).join("\n") : "- Empty"}\n\nPANTRY\n${pantry.length ? pantry.map(value => "- " + value).join("\n") : "- Empty"}`;
  }

  window.CookbookKitchen = {
    normalize, inferLocation, parseList, summary,
    loadInventory, saveInventory, addInventoryItem, updateInventoryItem,
    removeInventoryItem, useOne, replaceInventory, listSnapshots, restoreSnapshot,
    exportInventory, importInventory,
    loadCustomGroceries, saveCustomGroceries, addCustomGrocery, removeCustomGrocery,
    putAway,
  };
})();
