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
