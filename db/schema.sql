-- Aakriti's Wardrobe: PostgreSQL schema. Safe to run more than once.

CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS categories (
  id       text PRIMARY KEY,
  name     text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subcategories (
  id          text PRIMARY KEY,
  category_id text NOT NULL REFERENCES categories (id) ON UPDATE CASCADE ON DELETE CASCADE,
  name        text NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  UNIQUE (category_id, name),
  UNIQUE (category_id, id)
);

CREATE TABLE IF NOT EXISTS items (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  category_id   text NOT NULL REFERENCES categories (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  subcategory_id text,
  price         integer CHECK (price > 0),
  original_link text NOT NULL DEFAULT '',
  is_sample     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_category_subcategory_fkey
    FOREIGN KEY (category_id, subcategory_id) REFERENCES subcategories (category_id, id) ON UPDATE CASCADE ON DELETE RESTRICT
);
ALTER TABLE items ADD COLUMN IF NOT EXISTS subcategory_id text;
CREATE INDEX IF NOT EXISTS items_category_idx ON items (category_id);
CREATE INDEX IF NOT EXISTS items_subcategory_idx ON items (subcategory_id);
CREATE INDEX IF NOT EXISTS items_created_idx ON items (created_at DESC);

-- Photos are stored in the database so they survive redeploys on hosts
-- with temporary disks (Render). The browser resizes each photo before upload.
CREATE TABLE IF NOT EXISTS item_images (
  id           serial PRIMARY KEY,
  item_id      text NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  content_type text NOT NULL,
  data         bytea NOT NULL,
  position     integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS item_images_item_idx ON item_images (item_id, position);

-- Private ideas saved for later; only exposed through authenticated endpoints.
CREATE TABLE IF NOT EXISTS wishlist (
  id         text PRIMARY KEY,
  title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  url        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diary_entries (
  entry_date date PRIMARY KEY CHECK (entry_date >= DATE '2023-01-01'),
  status text NOT NULL CHECK (status IN ('in_progress', 'written')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Colour options keep their own ordered gallery and shopping link.
ALTER TABLE items ADD COLUMN IF NOT EXISTS colours jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Retain historical prices while allowing the catalogue to save without them.
ALTER TABLE items ALTER COLUMN price DROP NOT NULL;

-- Wear history is private and independent for each product colour.
CREATE TABLE IF NOT EXISTS item_wear_dates (
  item_id text NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  worn_on date NOT NULL CHECK (worn_on >= DATE '2023-01-01'),
  PRIMARY KEY (item_id, worn_on)
);

ALTER TABLE item_wear_dates ADD COLUMN IF NOT EXISTS colour_id text NOT NULL DEFAULT '';
DO $$
BEGIN
  IF (SELECT cardinality(conkey) FROM pg_constraint WHERE conrelid = 'item_wear_dates'::regclass AND conname = 'item_wear_dates_pkey') = 2 THEN
    ALTER TABLE item_wear_dates DROP CONSTRAINT item_wear_dates_pkey;
    ALTER TABLE item_wear_dates ADD PRIMARY KEY (item_id, colour_id, worn_on);
  END IF;
END
$$;
-- Earlier product-wide dates belong to the original/default colour.
INSERT INTO item_wear_dates (item_id, colour_id, worn_on)
SELECT w.item_id, i.colours->0->>'id', w.worn_on
FROM item_wear_dates w JOIN items i ON i.id = w.item_id
WHERE w.colour_id = '' AND jsonb_array_length(i.colours) > 0
ON CONFLICT DO NOTHING;
DELETE FROM item_wear_dates w USING items i
WHERE i.id = w.item_id AND w.colour_id = '' AND jsonb_array_length(i.colours) > 0;
