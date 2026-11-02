"""Recipe migration and shared-template regression tests."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from migrate import normalize, ingredient_count, process
from build import render, TEMPLATE, generated_listing

class CookbookTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.recipes, cls.warnings = process()

    def test_repository_recipe_data_is_valid(self):
        self.assertGreaterEqual(len(self.recipes), 1)
        for recipe in self.recipes:
            self.assertEqual(recipe["ingredient_count"], ingredient_count(recipe["ingredients"]))
            self.assertEqual(recipe["schema_version"], 2)

    def test_optional_ingredients_are_not_counted(self):
        items = [
            {"name": "Pasta", "optional": False},
            {"name": "pasta", "optional": False},
            {"name": "Parsley", "optional": True},
            {"name": "Salt", "optional": False},
        ]
        self.assertEqual(ingredient_count(items), 2)

    def test_unstructured_legacy_ingredients_do_not_invent_quantities(self):
        legacy = {
            "title": "Example", "category": "Dinner", "slug": "example",
            "servings": 4, "ingredients": ["2 eggs"], "instructions": ["Cook."]
        }
        warnings = []
        migrated = normalize(legacy, warnings)
        self.assertEqual(migrated["original_servings"], 4)
        self.assertIsNone(migrated["ingredients"][0]["quantity"])
        self.assertFalse(migrated["ingredients"][0]["scalable"])
        self.assertTrue(any("structured quantity" in w for w in warnings))

    def test_future_schema_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported future"):
            normalize({"schema_version": 999}, [])

    def test_all_pages_share_template_and_servings_dropdown(self):
        template = TEMPLATE.read_text(encoding="utf-8")
        self.assertIn('id="servings"', template)
        for recipe in self.recipes:
            page = render(recipe, template)
            self.assertIn("assets/recipe.js", page)
            self.assertIn('id="recipe-data"', page)
            self.assertIn('option value="10"', page)
            self.assertIn('option value="1"', page)
            self.assertIn(recipe["title"], page)
            self.assertNotIn("{{", page)

    def test_recipe_data_cannot_inject_html(self):
        recipe = dict(self.recipes[0])
        recipe["description"] = '</script><script>alert("x")</script>'
        page = render(recipe, TEMPLATE.read_text(encoding="utf-8"))
        self.assertNotIn('</script><script>alert', page)
        self.assertIn("&lt;/script&gt;", page)
        self.assertIn("\\u003c/script", page)

    def test_all_listed_links_use_existing_category(self):
        listing = generated_listing(self.recipes)
        self.assertEqual(len(listing), len(self.recipes))
        for item in listing:
            self.assertTrue(item["url"].startswith("./" + item["category"].lower() + "/"))

if __name__ == "__main__":
    unittest.main()
