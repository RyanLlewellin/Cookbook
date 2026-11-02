# Cookbook

A static, responsive recipe collection hosted on GitHub Pages.

**Live website:** https://ryanllewellin.github.io/Cookbook/

## How recipes work

- data/recipes.json is the **source of truth**. Add or edit recipes here.
- Each recipe has a category URL such as dinner/garlic-parmesan-pasta/.
- templates/recipe.html is the shared page layout. A layout change applies to **every recipe**.
- assets/recipe.js scales structured ingredient quantities when servings are changed from **1 to 10**.
- scripts/migrate.py safely updates old recipe records to the current schema, without inventing missing information.
- scripts/build.py renders the recipe pages, the root recipes.json index and a generated-path manifest.
- scripts/package.py builds a deployable _site/ folder.
- .github/workflows/cookbook.yml validates, migrates, rebuilds and publishes when recipe source files or the recipe processing skill change.

Read [RECIPE_PUBLISHER.md](RECIPE_PUBLISHER.md) and [.github/skills/recipe-processor/SKILL.md](.github/skills/recipe-processor/SKILL.md) before publishing a new recipe.

## Build locally

Python 3.10+ (no external dependencies):

```bash
python scripts/migrate.py --write
python -m unittest discover -s tests -v
python scripts/build.py
python scripts/package.py
```

Run a local web server, for example `python -m http.server 8000`, then open http://localhost:8000/.

## Retroactive updates

Changes to the skill file trigger a full rebuild. Shared display changes propagate automatically. Adding **new recipe data fields** also requires a deterministic migration and updated tests/renderer. Unknown original yields, ingredient amounts, times and difficulty are flagged or left blank, never silently fabricated.

Generated HTML and root recipes.json are committed for traceability, but do not hand-edit them. All source edits should go into data/recipes.json.
