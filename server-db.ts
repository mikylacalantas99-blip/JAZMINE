import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'jazmine.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('buyer', 'seller', 'admin')),
      bio TEXT NOT NULL DEFAULT '',
      store_name TEXT NOT NULL DEFAULT '',
      store_description TEXT NOT NULL DEFAULT '',
      store_location TEXT NOT NULL DEFAULT '',
      badges_json TEXT NOT NULL DEFAULT '[]',
      is_suspended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      title TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      size TEXT NOT NULL,
      condition TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      original_price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 1,
      allow_barter INTEGER NOT NULL DEFAULT 0,
      barter_preferences TEXT NOT NULL DEFAULT '',
      images_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'flagged', 'sold_out', 'archived')),
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS barter_offers (
      id TEXT PRIMARY KEY,
      proposer_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      requested_product_id TEXT NOT NULL,
      offered_product_id TEXT,
      offered_item_title TEXT NOT NULL,
      offered_item_image TEXT NOT NULL,
      cash_topup REAL NOT NULL DEFAULT 0,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'countered', 'completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (proposer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      product_id TEXT,
      last_message_at TEXT NOT NULL,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      body TEXT NOT NULL,
      offer_amount REAL,
      offer_status TEXT NOT NULL DEFAULT 'none' CHECK(offer_status IN ('none', 'pending', 'accepted', 'declined')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Placed' CHECK(status IN ('Placed', 'Authenticated', 'Shipped', 'Delivered', 'Cancelled')),
      total_amount REAL NOT NULL,
      shipping_name TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      shipping_postal TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      tracking_code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      title TEXT NOT NULL,
      image TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      negotiated_from REAL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wishlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(order_id, product_id, reviewer_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link_tab TEXT NOT NULL DEFAULT 'marketplace',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lookbooks (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      season TEXT NOT NULL,
      story TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      product_ids_json TEXT NOT NULL DEFAULT '[]',
      likes_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('product', 'user')),
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'dismissed')),
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (countRow.c === 0) {
    seedInitialData();
  }
}

function seedInitialData(): void {
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 86400000 * 3).toISOString();
  const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  const hashAtelier = bcrypt.hashSync('Atelier2026!', 10);
  const hashAdmin = bcrypt.hashSync('AdminJazmine2026!', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, bio, store_name, store_description, store_location, badges_json, is_suspended, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);

  insertUser.run(
    'admin-1',
    'mikylacalantas99@gmail.com',
    hashAdmin,
    'Mikyla Calantas',
    'admin',
    'Chief Curator & Platform Steward at JAZMINE.',
    'JAZMINE Curatorial Desk',
    'Official authentication and moderation desk for JAZMINE.',
    'Geneva · Rue du Rhône',
    JSON.stringify(['Platform Curator', 'Authenticator']),
    earlier
  );

  insertUser.run(
    'seller-1',
    'henri.laurent@jazmine.atelier',
    hashAtelier,
    'Henri Laurent',
    'seller',
    'Archivist of European tailoring and heirloom leatherwork.',
    'Maison Laurent Archive',
    'Family-curated 1980s–2000s European tailoring, camel hair outerwear, and hand-burnished footwear.',
    'Paris · 6th Arrondissement',
    JSON.stringify(['Verified Archivist', 'Heritage Curator', 'Fast Shipper']),
    earlier
  );

  insertUser.run(
    'seller-2',
    'beatrice.vance@jazmine.atelier',
    hashAtelier,
    'Beatrice Vance',
    'seller',
    'Private wardrobe collector specializing in silk carrés and structured calfskin.',
    'Vance Estate Wardrobe',
    'Pre-loved cashmere, Hermès silk carrés, and heirloom evening pieces kept in cedar-lined wardrobes.',
    'Boston · Beacon Hill',
    JSON.stringify(['Verified Archivist', 'Trusted Seller']),
    earlier
  );

  insertUser.run(
    'buyer-1',
    'claire.montgomery@jazmine.atelier',
    hashAtelier,
    'Claire Montgomery',
    'buyer',
    'Collector of quiet tailoring, equestrian silk, and heritage leather.',
    '',
    '',
    'New York · Upper East Side',
    JSON.stringify([]),
    earlier
  );

  const insertProduct = db.prepare(`
    INSERT INTO products (id, seller_id, title, brand, category, size, condition, description, price, original_price, stock, allow_barter, barter_preferences, images_json, status, featured, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `);

  insertProduct.run(
    'prod-1',
    'seller-1',
    'Belted Cashmere-Blend Trench Coat',
    'Max Mara Studio',
    'Outerwear',
    'IT 40 / US 6',
    'Archival Mint',
    'Double-breasted camel hair and virgin wool trench with horn buttons, storm welt pockets, and matching leather-buckled belt. Professionally steamed and stored in breathable cotton.',
    680,
    1850,
    2,
    1,
    'Open to structured calfskin handbags or Savile Row wool blazers.',
    JSON.stringify([
      '/src/assets/images/product_camel_coat_1795191633356.jpg',
      '/src/assets/images/hero_atelier_showcase_1795191633012.jpg',
    ]),
    1,
    earlier
  );

  insertProduct.run(
    'prod-2',
    'seller-2',
    'Structured Calfskin Top-Handle Satchel',
    'Delvaux Heritage',
    'Handbags',
    'Medium (28cm)',
    'Excellent Pre-Loved',
    'Deep muted burgundy box calfskin with hand-engraved antique brass clasp, suede-lined interior compartments, and original dust bag.',
    940,
    2600,
    1,
    1,
    'Seeking archival camel outerwear or fine baroque pearl jewelry.',
    JSON.stringify([
      '/src/assets/images/product_burgundy_bag_1795191632794.jpg',
      '/src/assets/images/lookbook_autumn_heritage_1795191632933.jpg',
    ]),
    1,
    earlier
  );

  insertProduct.run(
    'prod-3',
    'seller-2',
    'Equestrian Bridle Print Silk Twill Carré',
    'Hermès Paris',
    'Accessories',
    '90 × 90 cm',
    'Archival Mint',
    'Hand-rolled plumetis edges in ivory, espresso brown, and antique gold. Crisp silk hand with zero pulls; includes original orange presentation box.',
    340,
    550,
    3,
    1,
    'Open to vintage silk scarves, alligator belts, or heirloom brooches.',
    JSON.stringify([
      '/src/assets/images/product_silk_scarf_1795191632718.jpg',
      '/src/assets/images/hero_atelier_showcase_1795191633012.jpg',
    ]),
    1,
    twoDaysAgo
  );

  insertProduct.run(
    'prod-4',
    'seller-1',
    'Hand-Burnished Horsebit Leather Loafers',
    'Gucci Archive 1998',
    'Footwear',
    'EU 39 / US 8.5',
    'Excellent Pre-Loved',
    'Supple chocolate brown Tuscan calfskin with signature brushed brass horsebit hardware and Blake-stitched leather soles fitted with protective Vibram topy.',
    420,
    980,
    2,
    0,
    '',
    JSON.stringify([
      '/src/assets/images/product_loafer_shoes_1795191633185.jpg',
      '/src/assets/images/lookbook_autumn_heritage_1795191632933.jpg',
    ]),
    0,
    twoDaysAgo
  );

  insertProduct.run(
    'prod-5',
    'seller-1',
    'Herringbone Donegal Wool Tailored Blazer',
    'Ralph Lauren Purple Label',
    'Tailoring',
    'US 8 / M',
    'Archival Mint',
    'Full-canvas tailored herringbone tweed woven in Ireland, finished with genuine tortoiseshell buttons, ticket pocket, and cupro Bemberg lining.',
    510,
    1495,
    2,
    1,
    'Interested in fine-gauge cashmere knitwear or Italian leather loafers.',
    JSON.stringify([
      '/src/assets/images/product_tweed_blazer_1795191633154.jpg',
      '/src/assets/images/hero_atelier_showcase_1795191633012.jpg',
    ]),
    1,
    yesterday
  );

  insertProduct.run(
    'prod-6',
    'seller-2',
    'Baroque Pearl & Antique Brass Clip Earrings',
    'Chanel Gripoix Era',
    'Jewelry',
    'One Size (3.2cm)',
    'Excellent Pre-Loved',
    'Lustrous natural baroque pearls suspended from scrolled antique gold-plated brass medallions with comfort-padded French clips.',
    460,
    1120,
    2,
    1,
    'Open to vintage silk scarves or gold chain belts.',
    JSON.stringify([
      '/src/assets/images/product_pearl_earrings_1795191633463.jpg',
      '/src/assets/images/product_silk_scarf_1795191632718.jpg',
    ]),
    0,
    yesterday
  );

  const insertLookbook = db.prepare(`
    INSERT INTO lookbooks (id, author_id, title, season, story, cover_image, product_ids_json, likes_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertLookbook.run(
    'look-1',
    'seller-1',
    'Autumn Townhouse Tailoring',
    'Autumn / Winter',
    'Cream ribbed cashmere tucked into high-waisted espresso wool trousers, anchored by a structured burgundy satchel and horsebit loafers.',
    '/src/assets/images/lookbook_autumn_heritage_1795191632933.jpg',
    JSON.stringify(['prod-2', 'prod-4', 'prod-3']),
    42,
    twoDaysAgo
  );

  insertLookbook.run(
    'look-2',
    'seller-2',
    'The Beacon Hill Salon',
    'Transitional Heritage',
    'Double-breasted camel wool layered over Donegal herringbone tweed, finished with heirloom baroque pearl clips.',
    '/src/assets/images/hero_atelier_showcase_1795191633012.jpg',
    JSON.stringify(['prod-1', 'prod-5', 'prod-6']),
    37,
    yesterday
  );

  // Delivered order for Claire so she has order history + verified review showcase
  db.prepare(`
    INSERT INTO orders (id, buyer_id, status, total_amount, shipping_name, shipping_address, shipping_city, shipping_postal, payment_method, tracking_code, created_at, updated_at)
    VALUES (?, ?, 'Delivered', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'ORD-1041',
    'buyer-1',
    340,
    'Claire Montgomery',
    '740 Park Avenue, Apt 4B',
    'New York, NY',
    '10021',
    'Heritage Escrow Card',
    'JAZ-FR-884120',
    twoDaysAgo,
    yesterday
  );

  db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, seller_id, title, image, unit_price, quantity, negotiated_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'oi-1',
    'ORD-1041',
    'prod-3',
    'seller-2',
    'Equestrian Bridle Print Silk Twill Carré',
    '/src/assets/images/product_silk_scarf_1795191632718.jpg',
    340,
    1,
    null
  );

  db.prepare(`
    INSERT INTO reviews (id, order_id, product_id, seller_id, reviewer_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?, 5, ?, ?)
  `).run(
    'rev-1',
    'ORD-1041',
    'prod-3',
    'seller-2',
    'buyer-1',
    'Arrived wrapped in acid-free tissue with the original orange box. The hand-rolled edges are immaculate—truly archival condition.',
    now
  );

  // Sample wishlist item for Claire
  db.prepare(`
    INSERT INTO wishlists (id, user_id, product_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run('wish-1', 'buyer-1', 'prod-2', yesterday);

  // Sample conversation + price negotiation between Claire and Henri on prod-1
  db.prepare(`
    INSERT INTO conversations (id, buyer_id, seller_id, product_id, last_message_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('conv-1', 'buyer-1', 'seller-1', 'prod-1', yesterday);

  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, body, offer_amount, offer_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'msg-1',
    'conv-1',
    'buyer-1',
    'Bonjour Henri, the Max Mara camel trench is lovely. Could you confirm the shoulder-to-shoulder measurement, and would you consider $620?',
    620,
    'pending',
    yesterday
  );

  // Sample Barter Offer from Henri to Beatrice
  db.prepare(`
    INSERT INTO barter_offers (id, proposer_id, recipient_id, requested_product_id, offered_product_id, offered_item_title, offered_item_image, cash_topup, message, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    'barter-1',
    'seller-1',
    'seller-2',
    'prod-2',
    'prod-5',
    'Herringbone Donegal Wool Tailored Blazer',
    '/src/assets/images/product_tweed_blazer_1795191633154.jpg',
    280,
    'Beatrice, would you consider trading the burgundy Delvaux satchel for my archival Donegal blazer plus $280 balance?',
    yesterday,
    yesterday
  );

  // Sample notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, body, link_tab, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `);

  insertNotif.run(
    'notif-1',
    'seller-1',
    'offer',
    'New Price Offer ($620)',
    'Claire Montgomery proposed $620 for Belted Cashmere-Blend Trench Coat.',
    'messages',
    yesterday
  );

  insertNotif.run(
    'notif-2',
    'seller-2',
    'barter',
    'New Barter Proposal',
    'Maison Laurent Archive proposed a trade for Structured Calfskin Top-Handle Satchel.',
    'barter',
    yesterday
  );

  insertNotif.run(
    'notif-3',
    'buyer-1',
    'order',
    'Order ORD-1041 Delivered',
    'Your Equestrian Bridle Print Silk Twill Carré has been delivered.',
    'orders',
    yesterday
  );
}
