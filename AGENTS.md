# Cookbook repository instructions for coding agents

For any Cookbook recipe request:
1. Read .github/skills/recipe-processor/SKILL.md and RECIPE_PUBLISHER.md.
2. Fetch canonical data/recipes.json from the current default branch.
3. Prevent duplicates by source URL or normalized title.
4. Add or edit structured recipe data, not generated per-recipe HTML or root recipes.json.
5. Let the GitHub Actions workflow validate, safely migrate, rebuild all recipe pages from the shared template, and publish.
6. Do not invent ingredients, instructions, yields, source citations, or unmarked timing/difficulty estimates.

When skill requirements change, update scripts/migrate.py, scripts/build.py or templates/recipe.html as appropriate, and add tests. A text-only skill update triggers a rebuild but cannot invent code for new schema rules.

Preserve the existing /<category>/<slug>/ URL format, and keep servings adjustable from 1 to 10 using structured numeric ingredients.
