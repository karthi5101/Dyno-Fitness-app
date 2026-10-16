"""
MongoDB-backed Transformation Tracking domain.

Django's ORM is intentionally not used for transformation data.

Transformation records are stored in MongoDB through PyMongo.
"""

# No Django ORM model is required for this MongoDB-backed domain.