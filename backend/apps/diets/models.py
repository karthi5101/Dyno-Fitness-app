"""
MongoDB-backed Diet domain.

Django's ORM is intentionally not used for Diet domain data.

The actual documents are stored in MongoDB through PyMongo.
This file remains as the Django application model boundary so the
module has a conventional Django structure and can grow later without
moving domain responsibilities into another application.
"""