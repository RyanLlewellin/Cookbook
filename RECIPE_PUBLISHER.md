# Cookbook Recipe Publisher

Repository: https://github.com/RyanLlewellin/Cookbook

## Publishing policy
When the user shares a recipe (Instagram URL, screenshot, photo, or text) in the Cookbook project, publish it automatically through the connected GitHub tools without routine approval, provided the recipe can be extracted accurately. Read .github/skills/recipe-processor/SKILL.md first.

## Canonical data
- **Edit only data/recipes.json** when adding or changing recipe contents.
- Each recipe uses schema_version: 2, title, slug, category, description, original_servings, ingredients, instructions, source, image, difficulty, ingredient_count, prep_time_minutes, cook_time_minutes, total_time_minutes, estimated_fields.
- Category must be Breakfast, Lunch, Dinner, Snacks, Desserts, or Drinks.
- Ingredients are objects: name, quantity (number|null), unit, optional, and optional note/scalable.
- Preserve original amounts. Use scalable=false for unparsed amounts and seasonings "to taste".
- Record uncertainty in estimated_fields. Never silently invent quantities or instructions; missing values may remain null.
- Check source URL and normalized title for duplicates before inserting.
- For Instagram posts that cannot be read, request caption or screenshots rather than publishing an incomplete recipe.

## URLs and generated output
- Canonical URL uses the existing path scheme: /Cookbook/<category-lowercase>/<slug>/ for GitHub Pages.
- GitHub repository page: <category-lowercase>/<slug>/index.html.
- **Do not manually modify generated files:** recipes.json, data/generated_paths.json, or existing recipe page HTML.
- scripts/build.py generates those outputs from data/recipes.json and templates/recipe.html.
- assets/recipe.js provides the 1-10 servings selector and scaling across all recipe pages.
- The homepage loads generated recipes.json automatically.
- Preserve images and the original source URL when available.

## Automation and migration
- .github/workflows/cookbook.yml runs on recipe data, skill, template, migration script, asset, or test changes.
- It runs scripts/migrate.py --write, validates recipes with tests, rebuilds all pages, saves generated outputs, and deploys GitHub Pages.
- Migration code is deterministic: safely derivable values (e.g. ingredient_count) update all recipes. Uncertain times/difficulty are flagged for review, not hallucinated.
- Updating written skill guidance alone **does not implement arbitrary new schema logic**. Any new field or migration rule also requires a corresponding change to scripts/migrate.py, scripts/build.py/templates, and tests.
- Confirm successful GitHub commits and, when possible, the GitHub Actions deployment before reporting publication. Report exact failures.

## Useful commands
- python scripts/migrate.py --write
- python -m unittest discover -s tests -v
- python scripts/build.py
- python scripts/package.py
