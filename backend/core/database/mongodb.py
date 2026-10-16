import os

from pymongo import MongoClient
from pymongo.errors import PyMongoError


class MongoDB:
    _client = None
    _database = None

    @classmethod
    def connect(cls):
        if cls._client is not None and cls._database is not None:
            return cls._database

        mongo_uri = os.getenv("MONGODB_URI")
        database_name = os.getenv(
            "MONGODB_DATABASE",
            "dyno_fitness",
        )

        if not mongo_uri:
            raise RuntimeError(
                "MONGODB_URI environment variable is not configured."
            )

        try:
            client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=10000,
            )

            client.admin.command("ping")

            database = client[database_name]

            cls._client = client
            cls._database = database

            return cls._database

        except PyMongoError as exc:
            if "client" in locals():
                client.close()

            cls._client = None
            cls._database = None

            raise RuntimeError(
                f"Unable to connect to MongoDB: {exc}"
            ) from exc

    @classmethod
    def get_database(cls):
        if cls._database is None:
            return cls.connect()

        return cls._database

    @classmethod
    def close(cls):
        if cls._client is not None:
            cls._client.close()

        cls._client = None
        cls._database = None