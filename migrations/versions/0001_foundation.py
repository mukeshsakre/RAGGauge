"""Frozen PostgreSQL control-plane schema, revision 0001."""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "\nCREATE TABLE configuration_definitions (\n\tkey VARCHAR NOT NULL, \n\tschema_version INTEGER NOT NULL, \n\tpayload JSON NOT NULL, \n\tPRIMARY KEY (key, schema_version)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE configuration_scopes (\n\tid VARCHAR NOT NULL, \n\trevision INTEGER NOT NULL, \n\tactive_version VARCHAR, \n\tPRIMARY KEY (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE domain_records (\n\tid VARCHAR NOT NULL, \n\tkind VARCHAR NOT NULL, \n\tparent_id VARCHAR, \n\tpayload JSON NOT NULL, \n\tactor_id VARCHAR NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id)\n)\n\n"
    )
    op.execute("CREATE INDEX ix_domain_records_kind ON domain_records (kind)")
    op.execute("CREATE INDEX ix_domain_records_parent_id ON domain_records (parent_id)")
    op.execute(
        "\nCREATE TABLE execution_jobs (\n\tid VARCHAR NOT NULL, \n\texperiment_id VARCHAR NOT NULL, \n\tactor JSON NOT NULL, \n\tstatus VARCHAR NOT NULL, \n\teffective JSON, \n\tcases JSON NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\terror VARCHAR, \n\tPRIMARY KEY (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE users (\n\tid VARCHAR NOT NULL, \n\tusername VARCHAR NOT NULL, \n\tpassword_hash TEXT NOT NULL, \n\trole VARCHAR NOT NULL, \n\tenabled BOOLEAN NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (username)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE configuration_versions (\n\tid VARCHAR NOT NULL, \n\tscope VARCHAR NOT NULL, \n\trevision INTEGER NOT NULL, \n\tpayload JSON NOT NULL, \n\tactor_id VARCHAR NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (scope, revision), \n\tFOREIGN KEY(scope) REFERENCES configuration_scopes (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE sessions (\n\ttoken_hash VARCHAR NOT NULL, \n\tuser_id VARCHAR NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (token_hash), \n\tFOREIGN KEY(user_id) REFERENCES users (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE configuration_audit (\n\tid VARCHAR NOT NULL, \n\tversion_id VARCHAR NOT NULL, \n\tactor_id VARCHAR NOT NULL, \n\tscope VARCHAR NOT NULL, \n\tkey VARCHAR NOT NULL, \n\tbefore JSON, \n\tafter JSON, \n\treason TEXT, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(version_id) REFERENCES configuration_versions (id)\n)\n\n"
    )


def downgrade():
    raise RuntimeError(
        "Restore a database backup; destructive baseline downgrade is unsupported"
    )
