---
name: recipe-processor
description: Extract and normalize recipes from URLs, Instagram posts, screenshots, or pasted text for the Cookbook website.
---

# Recipe Processor

Use this skill whenever a user submits a recipe for the Cookbook project. Follow the existing website's recipe schema and page layout when available.

## Required metadata
- title
- category and URL-safe slug
- source URL and attribution
- servings
- ingredients: quantities, units, names, and optional status
- ingredient_count: number of distinct required ingredients; do not count optional garnishes, and count repeated ingredients once
- difficulty: Easy, Medium, or Hard
- prep_time_minutes: hands-on preparation
- cook_time_minutes: active/passive cooking time, excluding preparation
- total_time_minutes: elapsed time, including required resting/marinating when applicable; do not assume it is always prep + cook
- instructions: ordered actionable steps

## Difficulty rubric
- Easy: basic techniques, few steps, minimal coordination.
- Medium: multiple components, timing coordination, or intermediate techniques.
- Hard: advanced techniques, complex processes, or precise execution.

## Accuracy
Prefer explicit source information. If timing or difficulty is not supplied, derive a reasonable estimate and mark it as estimated in structured metadata. Never invent ingredient quantities or omit uncertainty silently. If the source cannot be accessed or does not provide sufficient recipe details, request the missing content.

## Publishing
Preserve existing Cookbook formatting, category paths, and navigation. Generate one dedicated page per recipe and link it from the homepage/category listing. Publish automatically when the connected GitHub workflow is available, per user preference. Avoid duplicate recipes and preserve original source attribution.

## Dynamic servings and scalable ingredients
- Every recipe must include original_servings (positive integer) and structured ingredient quantities as numeric amounts with units; retain the original source text as well.
- Recipe pages must provide a servings dropdown for integers 1 through 10, initially set to original_servings when within that range (otherwise choose a sensible in-range default while preserving original_servings for scaling).
- Recalculate each scalable ingredient as original_amount * selected_servings / original_servings, without mutating the source values.
- Format common kitchen fractions naturally (1/4, 1/3, 1/2, 2/3, 3/4) and preserve unit consistency. For eggs or indivisible items, show useful guidance rather than silently rounding.
- Do not scale 'to taste' ingredients automatically. Flag ingredients whose amounts cannot be parsed reliably rather than guessing.
- Do not linearly scale prep or cook times. Keep source timing and optionally add a note that larger batches may require adjustments.
- Implement scaling client-side without paid services, and ensure it works on mobile.

## Canonical recipe database and retroactive consistency
- Store source-of-truth recipes only in data/recipes.json, using schema_version: 2. The root recipes.json and per-recipe HTML are generated artifacts; do not edit them independently.
- Each ingredient is a structured object with name, quantity (number or null), unit, optional, optional note, and optional scalable. Keep original amounts for serving recalculations.
- All recipe pages are produced from templates/recipe.html and assets/recipe.js via scripts/build.py. The existing canonical URL pattern is /<category-lowercase>/<slug>/.
- GitHub Actions .github/workflows/cookbook.yml reruns validation, deterministic migrations, full page regeneration, and deployment when this skill or supported source files change.
- If this skill is changed to require new metadata, also implement safe conversion in scripts/migrate.py, appropriate shared-page changes in scripts/build.py or templates, and regression tests. Natural-language skill changes cannot automatically implement arbitrary code or infer unavailable recipe facts.
- Retain unknown values as null and emit REVIEW messages rather than introducing unsupported guesses. All preserved recipes must remain accessible after migration.
