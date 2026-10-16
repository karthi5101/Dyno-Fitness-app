from apps.diets.database import (
    get_diet_assignments_collection,
    get_diet_templates_collection,
)


def ensure_diet_indexes():
    templates = get_diet_templates_collection()
    assignments = get_diet_assignments_collection()

    templates.create_index(
        [("template_key", 1)],
        name="diet_template_key_unique",
        unique=True,
    )

    templates.create_index(
        [("name", 1)],
        name="diet_template_name",
    )

    assignments.create_index(
        [
            ("member_id", 1),
            ("assigned_date", -1),
        ],
        name="diet_assignment_member_date",
    )

    assignments.create_index(
        [
            ("template_key", 1),
        ],
        name="diet_assignment_template",
    )

    assignments.create_index(
        [
            ("status", 1),
        ],
        name="diet_assignment_status",
    )

    return {
        "templates": templates.index_information(),
        "assignments": assignments.index_information(),
    }