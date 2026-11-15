---
name: kitchen-storage-manager
description: Process grocery lists, receipts, screenshots, freezer/fridge/pantry photos and inventory updates into accurate kitchen inventory changes for Cyan's Cookbook.
---

# Kitchen Storage Manager

Use this skill whenever the user asks to add, remove, consume, move, reconcile, or update kitchen ingredients in Cyan's Cookbook from text, a list, a receipt, or a screenshot.

## Source of truth and access
- The live inventory is stored in the browser's localStorage under `cookbook-kitchen-inventory-v2`; it is **not** stored in the GitHub repository. Inventory is device/browser-specific unless the user exports and imports a backup.
- Do not claim to have changed the live inventory from a ChatGPT conversation unless a connected tool has actually updated that browser's storage.
- To update through the website, produce a paste-ready list using the Cookbook's bulk list syntax, then direct the user to https://ryanllewellin.github.io/Cookbook/pantry/ and its **Add these items** or **Replace inventory** action. For full reconciliation, first ask for an export or a current inventory copy if one is not available.
- The website can import a complete JSON backup via **Import inventory**. Preserve format/version and existing snapshot history when preparing a full replacement backup from an actual user-provided export. Do not fabricate existing inventory.
- Never edit GitHub source code as a substitute for changing a user's current inventory.

## Input formats
Accept:
1. Plain-text grocery or ingredient lists, including multi-location lists.
2. Screenshots of shopping carts, grocery orders, notes, receipts, or an existing inventory.
3. Photos of shelves/fridge/freezer; mark visually ambiguous items as uncertain.
4. Natural language such as "used 2 eggs", "move the salmon to the freezer", "we're out of milk".

Transcribe only identifiable items and quantities. Do not invent values, units, purchase state, or products. Treat an item visible on a shopping list as planned, not owned, unless the user says it was purchased or put away. Ask one concise question only when crucial to avoid an incorrect write.

## Extraction and normalization
Represent every distinct inventory update with:
- `name`: common ingredient/product name, retaining meaningful distinctions (e.g. whole vs skim milk).
- `quantity`: positive decimal number where given; if unspecified and adding, use 1 item only when the user indicates an item was acquired and the unit is inherently countable. Otherwise indicate unknown.
- `unit`: original unit such as lb, oz, g, can, box, bag, or blank for counted items.
- `location`: fridge, freezer or pantry.
- `operation`: add, consume, remove, set, or move.
- `confidence` and `notes` when source data is ambiguous.

Do not confuse product size with item count, e.g. "2 x 16 oz frozen peas" is 2 bags of 16 oz, not 32 bags. Preserve original packaging in notes if it matters.

## Location rules
1. Explicitly stated location always wins, including headings in screenshots.
2. "Frozen", "keep frozen", ice cream, frozen vegetables/meat/berries generally go to **freezer**.
3. Perishable refrigerated foods (milk, eggs, yogurt, fresh meat, refrigerated deli goods) generally go to **fridge**.
4. Shelf-stable goods (dry pasta, rice, unopened cans, flour, crackers) generally go to **pantry**.
5. Ambiguous items (bread, fresh produce, meat bought in bulk, shelf-stable vs refrigerated cartons) must be marked as assumptions or clarified; never infer freezer storage merely because something *could* be frozen.
6. Keep same product in multiple locations as separate inventory records; never silently relocate.

## Operation safety
- **Add/purchased**: increment matching name + location + unit only when actually acquired.
- **Consume/used**: decrement matching quantity; remove at zero. Do not create negative counts.
- **Remove/discard**: delete the matching inventory item.
- **Set/recount/replace**: replace specific quantities, not increment them, and retain unrelated items.
- **Move**: decrement source and increment destination in a single proposed transaction.
- Dedupe repeated receipts and screenshots when possible. Confirm unclear cross-location moves or large destructive replacements.
- Take a dated snapshot before bulk changes when the inventory is accessible.

## User-facing output
Summarize changes grouped by **Fridge**, **Freezer**, and **Pantry**, with quantities, operation, and confidence/assumption flags. Report any unreadable or uncertain lines separately.
For additions, give a copyable block in the website's exact syntax:
```text
2 lb chicken breast | freezer
1 carton milk | fridge
3 cans black beans | pantry
```
The website parses one item per line in `quantity unit name | location` format; it currently supports adding and whole-inventory replacement through bulk paste. **Do not suggest pasting consume/remove/set/move updates into Add these items**, because that would incorrectly increase quantities. For those operations, provide exact manual steps for the affected rows, or offer an updated backup only if the user provided the current export.
The website supports an inventory JSON backup and dated snapshots. For a screenshot that does not establish ownership, output a proposed update rather than stating it was applied.

## Integration with recipe and grocery features
- Use actual amounts and locations for ingredients already owned, when a current inventory snapshot is provided.
- Do not mark planned groceries as already available.
- Preserve the distinctions between grocery list, pantry inventory, refrigerator inventory and freezer inventory.
- Use existing CookbookKitchen data model and `.github/skills/recipe-processor/SKILL.md` for compatible ingredient normalization.

## Verification
Check that all items have correct quantities, units and destinations, that no uncertain items were silently added, and that the proposed change does not erase unrelated inventory. When website storage is not writable from the available tools, explicitly say the change is prepared, not applied.
