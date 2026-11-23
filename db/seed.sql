-- Starter data. Runs only when the categories table is empty.
-- Sample items are flagged so you can remove them from the admin page.

INSERT INTO settings (key, value) VALUES
  ('tagline', 'Women''s clothing, picked by Aakriti.'),
  ('whatsapp', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO categories (id, name, position) VALUES
  ('lingerie', 'Lingerie', 0),
  ('indian-wear', 'Indian Wear', 1),
  ('western-wear', 'Western Wear', 2),
  ('sleep-lounge', 'Sleep & Lounge', 3),
  ('sports-active', 'Sports & Active', 4),
  ('footwear', 'Footwear', 5),
  ('accessories', 'Accessories', 6),
  ('others', 'Others', 7);

INSERT INTO items (id, name, category_id, is_sample, created_at) VALUES
  ('s1',  'Lace Balconette Bra Set',      'lingerie', true, now() - interval '1 day'),
  ('s2',  'Seamless Everyday Bralette',   'lingerie', true, now() - interval '3 days'),
  ('s3',  'Longline Knit Cardigan',       'western-wear', true, now() - interval '5 days'),
  ('s4',  'Cropped Denim Jacket',         'western-wear', true, now() - interval '7 days'),
  ('s5',  'Ribbed Knit Top',              'western-wear', true, now() - interval '9 days'),
  ('s6',  'Puff-Sleeve Poplin Shirt',     'western-wear', true, now() - interval '11 days'),
  ('s7',  'High-Rise Wide-Leg Trousers',  'western-wear', true, now() - interval '13 days'),
  ('s8',  'Pleated Midi Skirt',           'western-wear', true, now() - interval '15 days'),
  ('s9',  'Linen Midi Dress',             'western-wear', true, now() - interval '17 days'),
  ('s10', 'Satin Slip Dress',             'western-wear', true, now() - interval '19 days'),
  ('s11', 'Cotton Pyjama Set',            'sleep-lounge', true, now() - interval '21 days'),
  ('s12', 'Modal Night Dress',            'sleep-lounge', true, now() - interval '23 days'),
  ('s13', 'Seamless Sports Bra',          'sports-active', true, now() - interval '25 days'),
  ('s14', 'High-Waist Training Tights',   'sports-active', true, now() - interval '27 days'),
  ('s15', 'Block-Heel Sandals',           'footwear', true, now() - interval '29 days'),
  ('s16', 'Everyday Canvas Sneakers',     'footwear', true, now() - interval '31 days');
