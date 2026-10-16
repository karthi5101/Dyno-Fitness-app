from core.database.mongodb import MongoDB


def main():
    database = MongoDB.get_database()

    print("MongoDB connection successful.")
    print(f"Database: {database.name}")

    MongoDB.close()


if __name__ == "__main__":
    main()