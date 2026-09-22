ALTER TABLE sessions
ADD COLUMN family_id UUID,
ADD COLUMN replaced_by_session_id UUID,
ADD COLUMN last_used_at TIMESTAMPTZ;

UPDATE sessions
SET family_id = id
WHERE family_id IS NULL;

ALTER TABLE sessions
ALTER COLUMN family_id SET NOT NULL;

ALTER TABLE sessions
ADD CONSTRAINT sessions_family_id_fkey
    FOREIGN KEY (family_id) REFERENCES sessions(id);

ALTER TABLE sessions
ADD CONSTRAINT sessions_replaced_by_session_id_fkey
    FOREIGN KEY (replaced_by_session_id) REFERENCES sessions(id);

CREATE INDEX sessions_family_id_idx
    ON sessions(family_id);

CREATE INDEX sessions_user_id_idx
    ON sessions(user_id);