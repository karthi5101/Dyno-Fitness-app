from django.core.management.base import BaseCommand

from apps.diets.database import get_diet_templates_collection
from apps.diets.repositories import utc_now


DIET_TEMPLATES = [
    {
        "template_key": "weight_loss",
        "name": "Weight Loss",
        "description": (
            "A simple calorie-controlled diet template focused on "
            "high-protein foods, vegetables, and sustainable portions."
        ),
        "target_calories": 1800,
        "meals": [
            {
                "name": "Breakfast",
                "meal_type": "breakfast",
                "items": [
                    {
                        "name": "Oats",
                        "quantity": "50 g",
                        "notes": "Cook with water or low-fat milk.",
                    },
                    {
                        "name": "Eggs",
                        "quantity": "2",
                        "notes": "Boiled or prepared with minimal oil.",
                    },
                    {
                        "name": "Banana",
                        "quantity": "1 small",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Mid-Morning Snack",
                "meal_type": "mid_morning_snack",
                "items": [
                    {
                        "name": "Apple",
                        "quantity": "1",
                        "notes": "",
                    },
                    {
                        "name": "Almonds",
                        "quantity": "10",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Lunch",
                "meal_type": "lunch",
                "items": [
                    {
                        "name": "Brown Rice",
                        "quantity": "150 g cooked",
                        "notes": "",
                    },
                    {
                        "name": "Grilled Chicken",
                        "quantity": "150 g",
                        "notes": "Use minimal oil.",
                    },
                    {
                        "name": "Mixed Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                    {
                        "name": "Curd",
                        "quantity": "100 g",
                        "notes": "Prefer low-fat curd.",
                    },
                ],
            },
            {
                "name": "Evening Snack",
                "meal_type": "evening_snack",
                "items": [
                    {
                        "name": "Green Tea",
                        "quantity": "1 cup",
                        "notes": "Avoid added sugar.",
                    },
                    {
                        "name": "Roasted Chana",
                        "quantity": "30 g",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Dinner",
                "meal_type": "dinner",
                "items": [
                    {
                        "name": "Roti",
                        "quantity": "2",
                        "notes": "",
                    },
                    {
                        "name": "Paneer",
                        "quantity": "100 g",
                        "notes": "Prefer low-fat paneer.",
                    },
                    {
                        "name": "Mixed Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                ],
            },
        ],
    },
    {
        "template_key": "weight_gain",
        "name": "Weight Gain",
        "description": (
            "A calorie-surplus template using protein-rich foods, "
            "complex carbohydrates, healthy fats, and regular meals."
        ),
        "target_calories": 2600,
        "meals": [
            {
                "name": "Breakfast",
                "meal_type": "breakfast",
                "items": [
                    {
                        "name": "Oats",
                        "quantity": "80 g",
                        "notes": "",
                    },
                    {
                        "name": "Milk",
                        "quantity": "300 ml",
                        "notes": "",
                    },
                    {
                        "name": "Banana",
                        "quantity": "1",
                        "notes": "",
                    },
                    {
                        "name": "Peanut Butter",
                        "quantity": "2 tbsp",
                        "notes": "",
                    },
                    {
                        "name": "Eggs",
                        "quantity": "3",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Mid-Morning Snack",
                "meal_type": "mid_morning_snack",
                "items": [
                    {
                        "name": "Mixed Nuts",
                        "quantity": "30 g",
                        "notes": "",
                    },
                    {
                        "name": "Fruit",
                        "quantity": "1 serving",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Lunch",
                "meal_type": "lunch",
                "items": [
                    {
                        "name": "Rice",
                        "quantity": "250 g cooked",
                        "notes": "",
                    },
                    {
                        "name": "Chicken",
                        "quantity": "180 g",
                        "notes": "",
                    },
                    {
                        "name": "Dal",
                        "quantity": "1 cup",
                        "notes": "",
                    },
                    {
                        "name": "Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                    {
                        "name": "Curd",
                        "quantity": "150 g",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Evening Snack",
                "meal_type": "evening_snack",
                "items": [
                    {
                        "name": "Banana Shake",
                        "quantity": "1 glass",
                        "notes": "Milk, banana, and peanut butter.",
                    },
                    {
                        "name": "Peanuts",
                        "quantity": "30 g",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Dinner",
                "meal_type": "dinner",
                "items": [
                    {
                        "name": "Roti",
                        "quantity": "3",
                        "notes": "",
                    },
                    {
                        "name": "Paneer",
                        "quantity": "150 g",
                        "notes": "",
                    },
                    {
                        "name": "Dal",
                        "quantity": "1 cup",
                        "notes": "",
                    },
                    {
                        "name": "Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                ],
            },
        ],
    },
    {
        "template_key": "maintenance",
        "name": "Maintenance",
        "description": (
            "A balanced everyday diet designed to maintain body weight "
            "while providing adequate protein, carbohydrates, and fats."
        ),
        "target_calories": 2200,
        "meals": [
            {
                "name": "Breakfast",
                "meal_type": "breakfast",
                "items": [
                    {
                        "name": "Idli",
                        "quantity": "3",
                        "notes": "",
                    },
                    {
                        "name": "Sambar",
                        "quantity": "1 cup",
                        "notes": "",
                    },
                    {
                        "name": "Eggs",
                        "quantity": "2",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Mid-Morning Snack",
                "meal_type": "mid_morning_snack",
                "items": [
                    {
                        "name": "Seasonal Fruit",
                        "quantity": "1 serving",
                        "notes": "",
                    },
                    {
                        "name": "Almonds",
                        "quantity": "10",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Lunch",
                "meal_type": "lunch",
                "items": [
                    {
                        "name": "Rice",
                        "quantity": "200 g cooked",
                        "notes": "",
                    },
                    {
                        "name": "Chicken or Paneer",
                        "quantity": "150 g",
                        "notes": "",
                    },
                    {
                        "name": "Dal",
                        "quantity": "1 cup",
                        "notes": "",
                    },
                    {
                        "name": "Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                    {
                        "name": "Curd",
                        "quantity": "100 g",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Evening Snack",
                "meal_type": "evening_snack",
                "items": [
                    {
                        "name": "Tea or Coffee",
                        "quantity": "1 cup",
                        "notes": "Limit added sugar.",
                    },
                    {
                        "name": "Roasted Chana",
                        "quantity": "30 g",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Dinner",
                "meal_type": "dinner",
                "items": [
                    {
                        "name": "Roti",
                        "quantity": "2",
                        "notes": "",
                    },
                    {
                        "name": "Chicken or Paneer",
                        "quantity": "150 g",
                        "notes": "",
                    },
                    {
                        "name": "Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                ],
            },
        ],
    },
    {
        "template_key": "high_protein",
        "name": "High Protein",
        "description": (
            "A protein-focused template suitable for members following "
            "strength-oriented training and seeking consistent protein intake."
        ),
        "target_calories": 2400,
        "meals": [
            {
                "name": "Breakfast",
                "meal_type": "breakfast",
                "items": [
                    {
                        "name": "Eggs",
                        "quantity": "4",
                        "notes": "",
                    },
                    {
                        "name": "Oats",
                        "quantity": "60 g",
                        "notes": "",
                    },
                    {
                        "name": "Milk",
                        "quantity": "250 ml",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Mid-Morning Snack",
                "meal_type": "mid_morning_snack",
                "items": [
                    {
                        "name": "Greek Yogurt or Curd",
                        "quantity": "200 g",
                        "notes": "",
                    },
                    {
                        "name": "Almonds",
                        "quantity": "15",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Lunch",
                "meal_type": "lunch",
                "items": [
                    {
                        "name": "Rice",
                        "quantity": "200 g cooked",
                        "notes": "",
                    },
                    {
                        "name": "Chicken",
                        "quantity": "200 g",
                        "notes": "",
                    },
                    {
                        "name": "Dal",
                        "quantity": "1 cup",
                        "notes": "",
                    },
                    {
                        "name": "Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Evening Snack",
                "meal_type": "evening_snack",
                "items": [
                    {
                        "name": "Eggs",
                        "quantity": "2",
                        "notes": "",
                    },
                    {
                        "name": "Fruit",
                        "quantity": "1 serving",
                        "notes": "",
                    },
                ],
            },
            {
                "name": "Dinner",
                "meal_type": "dinner",
                "items": [
                    {
                        "name": "Roti",
                        "quantity": "2",
                        "notes": "",
                    },
                    {
                        "name": "Chicken or Paneer",
                        "quantity": "180 g",
                        "notes": "",
                    },
                    {
                        "name": "Vegetables",
                        "quantity": "150 g",
                        "notes": "",
                    },
                    {
                        "name": "Curd",
                        "quantity": "100 g",
                        "notes": "",
                    },
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed the prototype diet templates into MongoDB."

    def handle(self, *args, **options):
        collection = get_diet_templates_collection()

        now = utc_now()

        created_count = 0
        updated_count = 0

        for template in DIET_TEMPLATES:
            template_key = template["template_key"]

            existing = collection.find_one(
                {
                    "template_key": template_key,
                }
            )

            if existing is None:
                document = {
                    **template,
                    "created_at": now,
                    "updated_at": now,
                }

                collection.insert_one(document)

                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Created: {template['name']}"
                    )
                )

            else:
                collection.update_one(
                    {
                        "template_key": template_key,
                    },
                    {
                        "$set": {
                            **template,
                            "updated_at": now,
                        }
                    },
                )

                updated_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Updated: {template['name']}"
                    )
                )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "Diet template seeding complete."
            )
        )
        self.stdout.write(
            f"Created: {created_count}"
        )
        self.stdout.write(
            f"Updated: {updated_count}"
        )
        self.stdout.write(
            f"Total templates: {collection.count_documents({})}"
        )