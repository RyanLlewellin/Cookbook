#!/usr/bin/env python3
"""Normalize Cookbook recipe data without guessing unsupported recipe facts."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "recipes.json"
CURRENT_SCHEMA = 2
CATEGORIES = {"Breakfast", "Lunch", "Dinner", "Snacks", "Desserts", "Drinks"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DIFFICULTIES = {"Easy", "Medium", "Hard"}

def ingredient_count(ingredients):
    """Count distinct required ingredients; optional garnishes are excluded."""
    names = set()
    for ingredient in ingredients:
        if not ingredient.get("optional"):
            name = re.sub(r"\s+", " ", ingredient["name"].strip().lower())
            if name:
                names.add(name)
    return len(names)

def normalize(recipe, warnings):
    recipe = dict(recipe)
    version = recipe.get("schema_version", 1)
    if version > CURRENT_SCHEMA:
        raise ValueError("Unsupported future schema_version: " + str(version))
    title = recipe.get("title", "(untitled)")
    if not isinstance(recipe.get("original_servings"), int):
        old = recipe.get("servings")
        if isinstance(old, int) and old > 0:
            recipe["original_servings"] = old
        else:
            recipe["original_servings"] = None
            warnings.append(title + ": original servings unknown, scaling disabled")
    for new, old in (("prep_time_minutes", "prepTime"), ("cook_time_minutes", "cookTime"), ("total_time_minutes", "totalTime")):
        if new not in recipe:
            recipe[new] = recipe.get(old)
    recipe.setdefault("difficulty", None)
    recipe.setdefault("estimated_fields", [])
    recipe.setdefault("source", {"type": "unknown", "url": None})
    recipe.setdefault("image", None)
    ingredients = []
    for i, ingredient in enumerate(recipe.get("ingredients", []), 1):
        if isinstance(ingredient, str):
            # Do not pretend an unparsed ingredient amount can scale.
            ingredient = {"name": ingredient, "quantity": None, "unit": "",
                          "optional": False, "scalable": False}
            warnings.append(title + ": ingredient " + str(i) + " needs structured quantity")
        if not isinstance(ingredient, dict) or not isinstance(ingredient.get("name"), str):
            raise ValueError(title + ": malformed ingredient " + str(i))
        ingredient = dict(ingredient)
        ingredient.setdefault("quantity", None)
        ingredient.setdefault("unit", "")
        ingredient.setdefault("optional", False)
        if ingredient.get("quantity") is None:
            ingredient["scalable"] = False
        else:
            ingredient.setdefault("scalable", True)
        ingredients.append(ingredient)
    recipe["ingredients"] = ingredients
    recipe["ingredient_count"] = ingredient_count(ingredients)
    recipe["schema_version"] = CURRENT_SCHEMA
    # Remove legacy aliases after migration.
    for key in ("servings", "prepTime", "cookTime", "totalTime"):
        recipe.pop(key, None)
    for field in ("prep_time_minutes", "cook_time_minutes", "total_time_minutes", "difficulty"):
        if recipe.get(field) is None:
            warnings.append(title + ": missing " + field)
    validate(recipe)
    return recipe

def validate(recipe):
    title = recipe.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("Recipe title is required")
    if recipe.get("category") not in CATEGORIES:
        raise ValueError(title + ": invalid category")
    if not isinstance(recipe.get("slug"), str) or not SLUG.fullmatch(recipe["slug"]):
        raise ValueError(title + ": invalid slug")
    servings = recipe["original_servings"]
    if servings is not None and (not isinstance(servings, int) or servings <= 0):
        raise ValueError(title + ": original_servings must be positive")
    if not recipe["ingredients"] or not isinstance(recipe.get("instructions"), list) or not recipe["instructions"]:
        raise ValueError(title + ": complete ingredients and instructions are required")
    if not all(isinstance(x, str) and x.strip() for x in recipe["instructions"]):
        raise ValueError(title + ": instructions must be nonempty text")
    if recipe["difficulty"] is not None and recipe["difficulty"] not in DIFFICULTIES:
        raise ValueError(title + ": invalid difficulty")
    for field in ("prep_time_minutes", "cook_time_minutes", "total_time_minutes"):
        value = recipe[field]
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0):
            raise ValueError(title + ": invalid " + field)
    for ingredient in recipe["ingredients"]:
        q = ingredient.get("quantity")
        if q is not None and (isinstance(q, bool) or not isinstance(q, (int, float)) or q <= 0):
            raise ValueError(title + ": invalid ingredient quantity")
    if not isinstance(recipe["estimated_fields"], list):
        raise ValueError(title + ": estimated_fields must be a list")

def process(path=DATA, write=False):
    recipes = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(recipes, list):
        raise ValueError("data/recipes.json must be an array")
    warnings = []
    migrated = [normalize(recipe, warnings) for recipe in recipes]
    keys = [(recipe["category"].lower(), recipe["slug"]) for recipe in migrated]
    if len(keys) != len(set(keys)):
        raise ValueError("Duplicate recipe category + slug")
    if write:
        Path(path).write_text(json.dumps(migrated, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return migrated, warnings

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Persist safe deterministic migrations")
    args = parser.parse_args()
    recipes, warnings = process(write=args.write)
    print("Validated " + str(len(recipes)) + " recipes at schema v" + str(CURRENT_SCHEMA))
    for warning in warnings:
        print("REVIEW: " + warning)

if __name__ == "__main__":
    main()
