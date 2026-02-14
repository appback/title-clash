-- Agent curation: allow agents to upload images and create problems

ALTER TABLE agents ADD COLUMN can_curate BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE problems ADD COLUMN curated_by UUID REFERENCES agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS problems_curated_by_idx ON problems(curated_by);
