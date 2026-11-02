# Cookbook Recipe Publisher

When the user shares a recipe (Instagram link, screenshot, photo, or text) in the Cookbook project, automatically publish to RyanLlewellin/Cookbook- without routine approval.

## Extraction
- Extract only supported title, ingredients, quantities, instructions, times, servings, and source.
- Do not invent missing quantities or cooking steps. Preserve original source URL.
- If Instagram cannot be accessed, ask for screenshots or caption. Do not publish a misleading incomplete recipe.
- Check for existing recipe with matching source URL or normalized title before creating a duplicate.

## Schema
Each recipe in data/recipes.json uses:
title (string), slug (string), category (Breakfast|Lunch|Dinner|Snacks|Desserts|Drinks), description (string), ingredients (string[]), instructions (string[]), image (string|null), url (string), source (object with type and url), servings (number|null), prepTime (number|null), cookTime (number|null).
Optional unknowns are null; never fabricate data.

## URLs
Canonical path: /recipes/<lowercase-category>/<unique-recipe-slug>/.
Create recipes/<category>/<slug>/index.html. Use stable unique slugs, avoiding collisions.

## Publishing
- Read current index.html and data/recipes.json from GitHub before changes.
- Generate each page from a consistent HTML layout compatible with the existing homepage style, with semantic headings, ingredient list, numbered directions, responsive layout, source link, and safe escaped text.
- Add a new recipe object to data/recipes.json without deleting existing entries.
- Ensure the homepage loads data/recipes.json and renders links; do not assume it already does.
- Publish to GitHub using connected GitHub tools. Confirm actual successful commits, not intended actions.
- If partial failure occurs, report exactly what succeeded and what remains.
- Return GitHub link to recipe and public URL only if hosting is configured.
- Ask the user only if critical details are missing.
