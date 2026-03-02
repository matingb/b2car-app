# Cursor Project Rules

TEST
- Define clear names for tests related to business rules. If unclear, ask.
- Use src/test/factory.ts to create entities and pass only the parameters relevant to the test

CODE REUSE / LIB
- Generic and repeatable code (helpers, formatters, mappers) must live in src/lib.
- Before creating a “local” formatting or mapping method in a specific file, check whether it already exists in src/lib (or whether it should be added there) to avoid duplication.