def seed_assignments(apps, schema_editor):
    # Idempotent: only seed if no assignments exist
    from core.database.mongodb import MongoDB
    db = MongoDB.get_database()
    assignments_col = db["trn_assignments"]
    if assignments_col.count_documents({}) > 0:
        return  # Already seeded


# The seed is triggered via a RunPython migration.
# To avoid Django app registration issues, the migration
# references this function without needing a full AppConfig.