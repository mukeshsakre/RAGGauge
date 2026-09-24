from alembic import context
from sqlalchemy import create_engine

from src import worker  # noqa: F401 - registers job metadata for autogenerate
from src.cli import database_url
from src.storage import Base

url = database_url()
if not url:
    raise RuntimeError("Database bootstrap configuration is missing")
if context.is_offline_mode():
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with create_engine(url).connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
