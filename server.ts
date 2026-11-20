import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { db, initDatabase } from './server-db.ts';

initDatabase();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'jazmine-atelier-heritage-secret-2026';

interface JwtPayload {
  userId: string;
  role: 'buyer' | 'seller' | 'admin';
  email: string;
}

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function parseJsonArray<T>(raw: unknown, fallback: T[]): T[] {
  if (typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeUser(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as 'buyer' | 'seller' | 'admin',
    bio: String(row.bio || ''),
    store_name: String(row.store_name || ''),
    store_description: String(row.store_description || ''),
    store_location: String(row.store_location || ''),
    badges: parseJsonArray<string>(row.badges_json, []),
    is_suspended: Boolean(row.is_suspended),
    created_at: String(row.created_at),
  };
}

function hydrateProduct(row: Record<string, unknown>) {
  const stats = db
    .prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM reviews WHERE product_id = ?')
    .get(String(row.id)) as { avg_rating: number | null; cnt: number };

  return {
    id: String(row.id),
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name || ''),
    seller_store_name: String(row.seller_store_name || row.seller_name || 'Private Wardrobe'),
    seller_location: String(row.seller_location || ''),
    seller_badges: parseJsonArray<string>(row.seller_badges_json, []),
    title: String(row.title),
    brand: String(row.brand),
    category: String(row.category),
    size: String(row.size),
    condition: String(row.condition),
    description: String(row.description),
    price: Number(row.price),
    original_price: Number(row.original_price),
    stock: Number(row.stock),
    allow_barter: Boolean(row.allow_barter),
    barter_preferences: String(row.barter_preferences || ''),
    images: parseJsonArray<string>(row.images_json, []),
    status: String(row.status),
    featured: Boolean(row.featured),
    rating_avg: stats?.avg_rating ? Number(stats.avg_rating.toFixed(1)) : 0,
    review_count: stats?.cnt || 0,
    created_at: String(row.created_at),
  };
}

// Track WebSocket connections per userId
const userSockets = new Map<string, Set<WebSocket>>();

function pushToUser(userId: string, event: string, payload: unknown): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  const frame = JSON.stringify({ event, payload });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(frame);
    }
  }
}

function broadcastAll(event: string, payload: unknown): void {
  const frame = JSON.stringify({ event, payload });
  for (const sockets of userSockets.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(frame);
      }
    }
  }
}

function createNotification(
  userId: string,
  type: 'message' | 'offer' | 'barter' | 'order' | 'review' | 'admin',
  title: string,
  body: string,
  linkTab = 'marketplace'
) {
  const id = genId('notif');
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, link_tab, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, userId, type, title, body, linkTab, createdAt);

  pushToUser(userId, 'notification:new', {
    id,
    user_id: userId,
    type,
    title,
    body,
    link_tab: linkTab,
    is_read: false,
    created_at: createdAt,
  });
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const userRow = db.prepare('SELECT id, role, email, is_suspended FROM users WHERE id = ?').get(decoded.userId) as
      | { id: string; role: 'buyer' | 'seller' | 'admin'; email: string; is_suspended: number }
      | undefined;
    if (!userRow) {
      res.status(401).json({ error: 'Account no longer exists' });
      return;
    }
    if (userRow.is_suspended) {
      res.status(403).json({ error: 'Account is suspended by moderation' });
      return;
    }
    req.user = { userId: userRow.id, role: userRow.role, email: userRow.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

function optionalAuth(req: AuthedRequest): JwtPayload | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    const row = db.prepare('SELECT id, role, email, is_suspended FROM users WHERE id = ?').get(decoded.userId) as
      | { id: string; role: 'buyer' | 'seller' | 'admin'; email: string; is_suspended: number }
      | undefined;
    if (!row || row.is_suspended) return null;
    return { userId: row.id, role: row.role, email: row.email };
  } catch {
    return null;
  }
}

function requireRole(...roles: Array<'buyer' | 'seller' | 'admin'>) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient role permissions for this action' });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(1008, 'Missing auth token');
      return;
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      let set = userSockets.get(decoded.userId);
      if (!set) {
        set = new Set();
        userSockets.set(decoded.userId, set);
      }
      set.add(ws);
      ws.send(JSON.stringify({ event: 'ws:connected', payload: { userId: decoded.userId } }));

      ws.on('close', () => {
        const s = userSockets.get(decoded.userId);
        if (s) {
          s.delete(ws);
          if (s.size === 0) userSockets.delete(decoded.userId);
        }
      });
    } catch {
      ws.close(1008, 'Invalid auth token');
    }
  });

  // ------------------------------------------------------------------
  // AUTH ROUTES
  // ------------------------------------------------------------------
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { email, password, name, role, storeName, storeLocation, storeDescription } = req.body || {};
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (String(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const assignedRole: 'buyer' | 'seller' = role === 'seller' ? 'seller' : 'buyer';
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    const id = genId(assignedRole);
    const hash = bcrypt.hashSync(String(password), 10);
    const createdAt = new Date().toISOString();
    const badges = assignedRole === 'seller' ? ['New Atelier'] : [];

    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, bio, store_name, store_description, store_location, badges_json, is_suspended, created_at)
       VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, 0, ?)`
    ).run(
      id,
      cleanEmail,
      hash,
      String(name).trim(),
      assignedRole,
      assignedRole === 'seller' ? String(storeName || `${String(name).trim()}'s Wardrobe`).trim() : '',
      assignedRole === 'seller' ? String(storeDescription || 'Curated pre-loved pieces from a private collection.').trim() : '',
      String(storeLocation || 'Private Salon').trim(),
      JSON.stringify(badges),
      createdAt
    );

    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    const token = jwt.sign({ userId: id, role: assignedRole, email: cleanEmail }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: sanitizeUser(userRow) });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as Record<string, unknown> | undefined;
    if (!row || !bcrypt.compareSync(String(password), String(row.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    if (row.is_suspended) {
      res.status(403).json({ error: 'This account has been suspended by moderation' });
      return;
    }
    const token = jwt.sign(
      { userId: String(row.id), role: String(row.role) as 'buyer' | 'seller' | 'admin', email: cleanEmail },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: sanitizeUser(row) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
    res.json({ user: sanitizeUser(row) });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res: Response) => {
    const { name, bio, store_name, store_description, store_location, upgradeToSeller } = req.body || {};
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
    let nextRole = String(current.role);
    let nextBadges = parseJsonArray<string>(current.badges_json, []);

    if (upgradeToSeller && nextRole === 'buyer') {
      nextRole = 'seller';
      if (nextBadges.length === 0) nextBadges = ['Atelier Member'];
    }

    db.prepare(
      `UPDATE users
       SET name = ?, bio = ?, store_name = ?, store_description = ?, store_location = ?, role = ?, badges_json = ?
       WHERE id = ?`
    ).run(
      name !== undefined ? String(name).trim() : String(current.name),
      bio !== undefined ? String(bio).trim() : String(current.bio),
      store_name !== undefined
        ? String(store_name).trim()
        : String(current.store_name || (nextRole === 'seller' ? `${String(current.name)}'s Atelier` : '')),
      store_description !== undefined ? String(store_description).trim() : String(current.store_description),
      store_location !== undefined ? String(store_location).trim() : String(current.store_location),
      nextRole,
      JSON.stringify(nextBadges),
      req.user!.userId
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as Record<string, unknown>;
    const token = jwt.sign(
      { userId: String(updated.id), role: String(updated.role) as 'buyer' | 'seller' | 'admin', email: String(updated.email) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: sanitizeUser(updated) });
  });

  // ------------------------------------------------------------------
  // PRODUCTS ROUTES
  // ------------------------------------------------------------------
  app.get('/api/products', (req: AuthedRequest, res: Response) => {
    const viewer = optionalAuth(req);
    const { category, search, condition, barterOnly, sellerId, sort, includeAll } = req.query;

    let sql = `
      SELECT p.*, u.name as seller_name, u.store_name as seller_store_name, u.store_location as seller_location, u.badges_json as seller_badges_json
      FROM products p
      JOIN users u ON u.id = p.seller_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    const canSeeAll =
      includeAll === 'true' &&
      viewer &&
      (viewer.role === 'admin' || (sellerId && String(sellerId) === viewer.userId));

    if (!canSeeAll) {
      sql += ` AND p.status IN ('active', 'sold_out') AND u.is_suspended = 0`;
    }

    if (category && category !== 'All') {
      sql += ` AND p.category = ?`;
      params.push(String(category));
    }
    if (condition && condition !== 'All') {
      sql += ` AND p.condition = ?`;
      params.push(String(condition));
    }
    if (barterOnly === 'true') {
      sql += ` AND p.allow_barter = 1`;
    }
    if (sellerId) {
      sql += ` AND p.seller_id = ?`;
      params.push(String(sellerId));
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim().toLowerCase()}%`;
      sql += ` AND (LOWER(p.title) LIKE ? OR LOWER(p.brand) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(u.store_name) LIKE ?)`;
      params.push(q, q, q, q);
    }

    if (sort === 'price_asc') sql += ` ORDER BY p.price ASC`;
    else if (sort === 'price_desc') sql += ` ORDER BY p.price DESC`;
    else sql += ` ORDER BY p.featured DESC, p.created_at DESC`;

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    res.json({ products: rows.map(hydrateProduct) });
  });

  app.get('/api/products/:id', (req: Request, res: Response) => {
    const row = db
      .prepare(
        `SELECT p.*, u.name as seller_name, u.store_name as seller_store_name, u.store_location as seller_location, u.badges_json as seller_badges_json
         FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = ?`
      )
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const reviews = db
      .prepare(
        `SELECT r.*, u.name as reviewer_name
         FROM reviews r JOIN users u ON u.id = r.reviewer_id
         WHERE r.product_id = ? ORDER BY r.created_at DESC`
      )
      .all(req.params.id);

    res.json({ product: hydrateProduct(row), reviews });
  });

  app.post('/api/products', requireAuth, requireRole('seller', 'admin'), (req: AuthedRequest, res: Response) => {
    const {
      title,
      brand,
      category,
      size,
      condition,
      description,
      price,
      original_price,
      stock,
      allow_barter,
      barter_preferences,
      images,
    } = req.body || {};

    if (!title || !brand || !category || price === undefined) {
      res.status(400).json({ error: 'Title, brand, category, and price are required' });
      return;
    }

    const cleanImages = Array.isArray(images) && images.length > 0
      ? images.slice(0, 6).map(String)
      : ['/src/assets/images/product_camel_coat_1795191633356.jpg'];

    const id = genId('prod');
    const createdAt = new Date().toISOString();
    const numericStock = Math.max(0, Math.floor(Number(stock ?? 1)));
    const status = numericStock === 0 ? 'sold_out' : 'active';

    db.prepare(
      `INSERT INTO products (id, seller_id, title, brand, category, size, condition, description, price, original_price, stock, allow_barter, barter_preferences, images_json, status, featured, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      id,
      req.user!.userId,
      String(title).trim(),
      String(brand).trim(),
      String(category).trim(),
      String(size || 'One Size').trim(),
      String(condition || 'Excellent Pre-Loved').trim(),
      String(description || '').trim(),
      Math.max(1, Number(price)),
      Math.max(Number(price), Number(original_price || price)),
      numericStock,
      allow_barter ? 1 : 0,
      String(barter_preferences || '').trim(),
      JSON.stringify(cleanImages),
      status,
      createdAt
    );

    const created = db
      .prepare(
        `SELECT p.*, u.name as seller_name, u.store_name as seller_store_name, u.store_location as seller_location, u.badges_json as seller_badges_json
         FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = ?`
      )
      .get(id) as Record<string, unknown>;

    const product = hydrateProduct(created);
    broadcastAll('stock:updated', { productId: product.id, stock: product.stock, status: product.status });
    res.status(201).json({ product });
  });

  app.patch('/api/products/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    if (existing.seller_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only the listing owner or an admin can edit this piece' });
      return;
    }

    const { title, brand, category, size, condition, description, price, original_price, stock, allow_barter, barter_preferences, images, status } =
      req.body || {};

    const nextStock = stock !== undefined ? Math.max(0, Math.floor(Number(stock))) : Number(existing.stock);
    let nextStatus = status !== undefined ? String(status) : String(existing.status);
    if (nextStatus !== 'flagged' && nextStatus !== 'archived') {
      nextStatus = nextStock === 0 ? 'sold_out' : 'active';
    }

    db.prepare(
      `UPDATE products
       SET title = ?, brand = ?, category = ?, size = ?, condition = ?, description = ?, price = ?, original_price = ?, stock = ?, allow_barter = ?, barter_preferences = ?, images_json = ?, status = ?
       WHERE id = ?`
    ).run(
      title !== undefined ? String(title).trim() : String(existing.title),
      brand !== undefined ? String(brand).trim() : String(existing.brand),
      category !== undefined ? String(category).trim() : String(existing.category),
      size !== undefined ? String(size).trim() : String(existing.size),
      condition !== undefined ? String(condition).trim() : String(existing.condition),
      description !== undefined ? String(description).trim() : String(existing.description),
      price !== undefined ? Math.max(1, Number(price)) : Number(existing.price),
      original_price !== undefined ? Math.max(1, Number(original_price)) : Number(existing.original_price),
      nextStock,
      allow_barter !== undefined ? (allow_barter ? 1 : 0) : Number(existing.allow_barter),
      barter_preferences !== undefined ? String(barter_preferences).trim() : String(existing.barter_preferences),
      Array.isArray(images) && images.length > 0 ? JSON.stringify(images.slice(0, 6)) : String(existing.images_json),
      nextStatus,
      req.params.id
    );

    const updated = db
      .prepare(
        `SELECT p.*, u.name as seller_name, u.store_name as seller_store_name, u.store_location as seller_location, u.badges_json as seller_badges_json
         FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = ?`
      )
      .get(req.params.id) as Record<string, unknown>;

    const product = hydrateProduct(updated);
    broadcastAll('stock:updated', { productId: product.id, stock: product.stock, status: product.status });
    res.json({ product });
  });

  app.delete('/api/products/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const existing = db.prepare('SELECT seller_id FROM products WHERE id = ?').get(req.params.id) as
      | { seller_id: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }
    if (existing.seller_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Not authorized to remove this listing' });
      return;
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  });

  // ------------------------------------------------------------------
  // WISHLISTS
  // ------------------------------------------------------------------
  app.get('/api/wishlists', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db.prepare('SELECT product_id FROM wishlists WHERE user_id = ?').all(req.user!.userId) as Array<{
      product_id: string;
    }>;
    res.json({ productIds: rows.map((r) => r.product_id) });
  });

  app.post('/api/wishlists/:productId', requireAuth, (req: AuthedRequest, res: Response) => {
    const existing = db
      .prepare('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?')
      .get(req.user!.userId, req.params.productId) as { id: string } | undefined;

    if (existing) {
      db.prepare('DELETE FROM wishlists WHERE id = ?').run(existing.id);
      res.json({ saved: false });
    } else {
      db.prepare('INSERT INTO wishlists (id, user_id, product_id, created_at) VALUES (?, ?, ?, ?)').run(
        genId('wish'),
        req.user!.userId,
        req.params.productId,
        new Date().toISOString()
      );
      res.json({ saved: true });
    }
  });

  // ------------------------------------------------------------------
  // REAL-TIME MESSAGING & PRICE NEGOTIATION
  // ------------------------------------------------------------------
  app.get('/api/conversations', requireAuth, (req: AuthedRequest, res: Response) => {
    const uid = req.user!.userId;
    const rows = db
      .prepare(
        `SELECT c.*,
                b.name as buyer_name,
                s.name as seller_name,
                s.store_name as seller_store_name,
                p.title as product_title,
                p.price as product_price,
                p.images_json as product_images_json,
                (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_preview
         FROM conversations c
         JOIN users b ON b.id = c.buyer_id
         JOIN users s ON s.id = c.seller_id
         LEFT JOIN products p ON p.id = c.product_id
         WHERE c.buyer_id = ? OR c.seller_id = ?
         ORDER BY c.last_message_at DESC`
      )
      .all(uid, uid) as Array<Record<string, unknown>>;

    const conversations = rows.map((r) => {
      const imgs = parseJsonArray<string>(r.product_images_json, []);
      return {
        id: String(r.id),
        buyer_id: String(r.buyer_id),
        buyer_name: String(r.buyer_name),
        seller_id: String(r.seller_id),
        seller_name: String(r.seller_name),
        seller_store_name: String(r.seller_store_name || r.seller_name),
        product_id: r.product_id ? String(r.product_id) : null,
        product_title: r.product_title ? String(r.product_title) : null,
        product_image: imgs[0] || null,
        product_price: r.product_price !== null ? Number(r.product_price) : null,
        last_message_at: String(r.last_message_at),
        last_message_preview: String(r.last_message_preview || 'Conversation opened'),
      };
    });

    res.json({ conversations });
  });

  app.post('/api/conversations', requireAuth, (req: AuthedRequest, res: Response) => {
    const { sellerId, productId } = req.body || {};
    if (!sellerId) {
      res.status(400).json({ error: 'sellerId is required' });
      return;
    }
    const buyerId = req.user!.userId;
    if (buyerId === sellerId) {
      res.status(400).json({ error: 'You cannot start a negotiation with your own storefront' });
      return;
    }

    const existing = db
      .prepare(
        `SELECT id FROM conversations WHERE buyer_id = ? AND seller_id = ? AND (product_id = ? OR (? IS NULL AND product_id IS NULL))`
      )
      .get(buyerId, sellerId, productId || null, productId || null) as { id: string } | undefined;

    if (existing) {
      res.json({ conversationId: existing.id });
      return;
    }

    const id = genId('conv');
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO conversations (id, buyer_id, seller_id, product_id, last_message_at) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      buyerId,
      sellerId,
      productId || null,
      now
    );

    res.status(201).json({ conversationId: id });
  });

  app.get('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res: Response) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as
      | { id: string; buyer_id: string; seller_id: string }
      | undefined;
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (conv.buyer_id !== req.user!.userId && conv.seller_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = db
      .prepare(
        `SELECT m.*, u.name as sender_name
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ?
         ORDER BY m.created_at ASC`
      )
      .all(req.params.id);

    res.json({ messages });
  });

  app.post('/api/conversations/:id/messages', requireAuth, (req: AuthedRequest, res: Response) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as
      | { id: string; buyer_id: string; seller_id: string; product_id: string | null }
      | undefined;
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    if (conv.buyer_id !== req.user!.userId && conv.seller_id !== req.user!.userId) {
      res.status(403).json({ error: 'Only participants can post messages' });
      return;
    }

    const { body, offerAmount } = req.body || {};
    if (!body && !offerAmount) {
      res.status(400).json({ error: 'Message body or offer amount is required' });
      return;
    }

    const msgId = genId('msg');
    const now = new Date().toISOString();
    const numericOffer = offerAmount ? Math.max(1, Number(offerAmount)) : null;
    const offerStatus = numericOffer ? 'pending' : 'none';
    const textBody = body ? String(body).trim() : `Submitted formal offer of $${numericOffer}`;

    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_id, body, offer_amount, offer_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(msgId, conv.id, req.user!.userId, textBody, numericOffer, offerStatus, now);

    db.prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?').run(now, conv.id);

    const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user!.userId) as { name: string };
    const messageObj = {
      id: msgId,
      conversation_id: conv.id,
      sender_id: req.user!.userId,
      sender_name: sender.name,
      body: textBody,
      offer_amount: numericOffer,
      offer_status: offerStatus,
      created_at: now,
    };

    const recipientId = req.user!.userId === conv.buyer_id ? conv.seller_id : conv.buyer_id;
    pushToUser(recipientId, 'message:new', messageObj);
    pushToUser(req.user!.userId, 'message:new', messageObj);

    createNotification(
      recipientId,
      numericOffer ? 'offer' : 'message',
      numericOffer ? `New Offer ($${numericOffer})` : `Message from ${sender.name}`,
      textBody.slice(0, 120),
      'messages'
    );

    res.status(201).json({ message: messageObj });
  });

  app.patch('/api/messages/:id/offer', requireAuth, (req: AuthedRequest, res: Response) => {
    const { decision } = req.body || {};
    if (decision !== 'accepted' && decision !== 'declined') {
      res.status(400).json({ error: 'Decision must be accepted or declined' });
      return;
    }

    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id) as
      | { id: string; conversation_id: string; sender_id: string; offer_amount: number | null; offer_status: string }
      | undefined;
    if (!msg || !msg.offer_amount) {
      res.status(404).json({ error: 'Offer message not found' });
      return;
    }

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(msg.conversation_id) as {
      id: string;
      buyer_id: string;
      seller_id: string;
      product_id: string | null;
    };

    if (req.user!.userId !== conv.seller_id && req.user!.userId !== conv.buyer_id) {
      res.status(403).json({ error: 'Not authorized to respond to this offer' });
      return;
    }
    if (msg.sender_id === req.user!.userId) {
      res.status(403).json({ error: 'You cannot accept or decline your own offer' });
      return;
    }

    db.prepare('UPDATE messages SET offer_status = ? WHERE id = ?').run(decision, msg.id);

    const payload = { messageId: msg.id, conversationId: conv.id, offerStatus: decision, offerAmount: msg.offer_amount };
    pushToUser(conv.buyer_id, 'offer:updated', payload);
    pushToUser(conv.seller_id, 'offer:updated', payload);

    createNotification(
      msg.sender_id,
      'offer',
      decision === 'accepted' ? `Offer Accepted ($${msg.offer_amount})` : `Offer Declined ($${msg.offer_amount})`,
      decision === 'accepted'
        ? 'Your negotiated price was accepted. You may now add the piece to your bag at the agreed rate.'
        : 'The seller declined your price proposal. Feel free to send a revised offer.',
      'messages'
    );

    res.json({ updated: true, offerStatus: decision });
  });

  // ------------------------------------------------------------------
  // THE BARTER ROOM
  // ------------------------------------------------------------------
  app.get('/api/barters', requireAuth, (req: AuthedRequest, res: Response) => {
    const uid = req.user!.userId;
    const rows = db
      .prepare(
        `SELECT b.*,
                prop.name as proposer_name, prop.store_name as proposer_store_name,
                rec.name as recipient_name, rec.store_name as recipient_store_name,
                rp.title as requested_product_title, rp.price as requested_product_price, rp.images_json as requested_product_images
         FROM barter_offers b
         JOIN users prop ON prop.id = b.proposer_id
         JOIN users rec ON rec.id = b.recipient_id
         JOIN products rp ON rp.id = b.requested_product_id
         WHERE b.proposer_id = ? OR b.recipient_id = ?
         ORDER BY b.updated_at DESC`
      )
      .all(uid, uid) as Array<Record<string, unknown>>;

    const offers = rows.map((r) => {
      const reqImgs = parseJsonArray<string>(r.requested_product_images, []);
      return {
        id: String(r.id),
        proposer_id: String(r.proposer_id),
        proposer_name: String(r.proposer_name),
        proposer_store_name: String(r.proposer_store_name || r.proposer_name),
        recipient_id: String(r.recipient_id),
        recipient_name: String(r.recipient_name),
        recipient_store_name: String(r.recipient_store_name || r.recipient_name),
        requested_product_id: String(r.requested_product_id),
        requested_product_title: String(r.requested_product_title),
        requested_product_image: reqImgs[0] || '',
        requested_product_price: Number(r.requested_product_price),
        offered_product_id: r.offered_product_id ? String(r.offered_product_id) : null,
        offered_item_title: String(r.offered_item_title),
        offered_item_image: String(r.offered_item_image),
        cash_topup: Number(r.cash_topup || 0),
        message: String(r.message || ''),
        status: String(r.status),
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      };
    });

    res.json({ offers });
  });

  app.post('/api/barters', requireAuth, (req: AuthedRequest, res: Response) => {
    const { requestedProductId, offeredProductId, offeredItemTitle, offeredItemImage, cashTopup, message } =
      req.body || {};

    const target = db.prepare('SELECT * FROM products WHERE id = ?').get(requestedProductId) as
      | Record<string, unknown>
      | undefined;

    if (!target) {
      res.status(404).json({ error: 'Target listing not found' });
      return;
    }
    if (!target.allow_barter) {
      res.status(400).json({ error: 'This listing is not open for barter trades' });
      return;
    }
    if (target.seller_id === req.user!.userId) {
      res.status(400).json({ error: 'You cannot propose a barter on your own piece' });
      return;
    }

    let itemTitle = String(offeredItemTitle || '').trim();
    let itemImage = String(offeredItemImage || '/src/assets/images/product_silk_scarf_1795191632718.jpg');

    if (offeredProductId) {
      const ownProd = db.prepare('SELECT * FROM products WHERE id = ? AND seller_id = ?').get(
        offeredProductId,
        req.user!.userId
      ) as Record<string, unknown> | undefined;
      if (!ownProd) {
        res.status(400).json({ error: 'Selected inventory item not found in your storefront' });
        return;
      }
      itemTitle = String(ownProd.title);
      const imgs = parseJsonArray<string>(ownProd.images_json, []);
      if (imgs[0]) itemImage = imgs[0];
    }

    if (!itemTitle) {
      res.status(400).json({ error: 'Please specify or select an item to offer in exchange' });
      return;
    }

    const id = genId('barter');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO barter_offers (id, proposer_id, recipient_id, requested_product_id, offered_product_id, offered_item_title, offered_item_image, cash_topup, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      id,
      req.user!.userId,
      String(target.seller_id),
      String(target.id),
      offeredProductId || null,
      itemTitle,
      itemImage,
      Math.max(0, Number(cashTopup || 0)),
      String(message || '').trim(),
      now,
      now
    );

    const proposer = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user!.userId) as { name: string };
    createNotification(
      String(target.seller_id),
      'barter',
      'New Barter Proposal',
      `${proposer.name} offered "${itemTitle}" for ${String(target.title)}.`,
      'barter'
    );
    pushToUser(String(target.seller_id), 'barter:updated', { barterId: id, status: 'pending' });
    pushToUser(req.user!.userId, 'barter:updated', { barterId: id, status: 'pending' });

    res.status(201).json({ barterId: id });
  });

  app.patch('/api/barters/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    const { status } = req.body || {};
    if (!['accepted', 'declined', 'completed'].includes(status)) {
      res.status(400).json({ error: 'Invalid barter decision' });
      return;
    }

    const barter = db.prepare('SELECT * FROM barter_offers WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!barter) {
      res.status(404).json({ error: 'Barter offer not found' });
      return;
    }
    if (barter.recipient_id !== req.user!.userId && barter.proposer_id !== req.user!.userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    if ((status === 'accepted' || status === 'declined') && barter.recipient_id !== req.user!.userId) {
      res.status(403).json({ error: 'Only the listing owner can accept or decline this trade' });
      return;
    }

    const runUpdate = db.transaction(() => {
      const now = new Date().toISOString();
      db.prepare('UPDATE barter_offers SET status = ?, updated_at = ? WHERE id = ?').run(status, now, barter.id);

      if (status === 'accepted') {
        const reqProd = db.prepare('SELECT stock FROM products WHERE id = ?').get(barter.requested_product_id) as
          | { stock: number }
          | undefined;
        if (reqProd && reqProd.stock > 0) {
          const nextStock = reqProd.stock - 1;
          db.prepare('UPDATE products SET stock = ?, status = ? WHERE id = ?').run(
            nextStock,
            nextStock === 0 ? 'sold_out' : 'active',
            barter.requested_product_id
          );
          broadcastAll('stock:updated', {
            productId: barter.requested_product_id,
            stock: nextStock,
            status: nextStock === 0 ? 'sold_out' : 'active',
          });
        }
        if (barter.offered_product_id) {
          const offProd = db.prepare('SELECT stock FROM products WHERE id = ?').get(barter.offered_product_id) as
            | { stock: number }
            | undefined;
          if (offProd && offProd.stock > 0) {
            const nextOffStock = offProd.stock - 1;
            db.prepare('UPDATE products SET stock = ?, status = ? WHERE id = ?').run(
              nextOffStock,
              nextOffStock === 0 ? 'sold_out' : 'active',
              barter.offered_product_id
            );
            broadcastAll('stock:updated', {
              productId: barter.offered_product_id,
              stock: nextOffStock,
              status: nextOffStock === 0 ? 'sold_out' : 'active',
            });
          }
        }
      }
    });

    runUpdate();

    createNotification(
      String(barter.proposer_id),
      'barter',
      status === 'accepted' ? 'Barter Trade Accepted' : 'Barter Proposal Declined',
      status === 'accepted'
        ? `Your trade offer of "${String(barter.offered_item_title)}" has been accepted.`
        : `Your trade offer of "${String(barter.offered_item_title)}" was declined.`,
      'barter'
    );

    pushToUser(String(barter.proposer_id), 'barter:updated', { barterId: barter.id, status });
    pushToUser(String(barter.recipient_id), 'barter:updated', { barterId: barter.id, status });

    res.json({ updated: true, status });
  });

  // ------------------------------------------------------------------
  // CART CHECKOUT, AUTOMATIC STOCK MANAGEMENT & ORDER TRACKING
  // ------------------------------------------------------------------
  app.post('/api/orders/checkout', requireAuth, (req: AuthedRequest, res: Response) => {
    const { items, shippingName, shippingAddress, shippingCity, shippingPostal, paymentMethod } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Shopping bag is empty' });
      return;
    }
    if (!shippingName || !shippingAddress || !shippingCity || !shippingPostal) {
      res.status(400).json({ error: 'Complete shipping details are required' });
      return;
    }

    const orderId = `ORD-${Math.floor(1050 + Math.random() * 8900)}`;
    const now = new Date().toISOString();
    const trackingCode = `JAZ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    try {
      const result = db.transaction(() => {
        let totalAmount = 0;
        const notifiedSellers = new Set<string>();
        const stockChanges: Array<{ productId: string; stock: number; status: string }> = [];

        const preparedItems: Array<{
          productId: string;
          sellerId: string;
          title: string;
          image: string;
          unitPrice: number;
          quantity: number;
          negotiatedFrom: number | null;
        }> = [];

        for (const entry of items) {
          const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(entry.productId) as
            | Record<string, unknown>
            | undefined;
          if (!prod) {
            throw new Error('One of the items in your bag is no longer available');
          }
          if (prod.seller_id === req.user!.userId) {
            throw new Error(`You cannot purchase your own listing (${String(prod.title)})`);
          }
          const qty = Math.max(1, Math.floor(Number(entry.quantity || 1)));
          if (Number(prod.stock) < qty || prod.status !== 'active') {
            throw new Error(`Insufficient stock for ${String(prod.title)} (available: ${Number(prod.stock)})`);
          }

          let unitPrice = Number(prod.price);
          let negotiatedFrom: number | null = null;

          // Verify if user has an accepted negotiated price offer for this product
          if (entry.agreedPrice && Number(entry.agreedPrice) < unitPrice) {
            const acceptedOffer = db
              .prepare(
                `SELECT m.offer_amount FROM messages m
                 JOIN conversations c ON c.id = m.conversation_id
                 WHERE c.buyer_id = ? AND c.product_id = ? AND m.offer_status = 'accepted' AND m.offer_amount = ?
                 ORDER BY m.created_at DESC LIMIT 1`
              )
              .get(req.user!.userId, prod.id, Number(entry.agreedPrice)) as { offer_amount: number } | undefined;

            if (acceptedOffer) {
              negotiatedFrom = unitPrice;
              unitPrice = acceptedOffer.offer_amount;
            }
          }

          totalAmount += unitPrice * qty;
          const nextStock = Number(prod.stock) - qty;
          const nextStatus = nextStock === 0 ? 'sold_out' : 'active';

          db.prepare('UPDATE products SET stock = ?, status = ? WHERE id = ?').run(nextStock, nextStatus, prod.id);
          stockChanges.push({ productId: String(prod.id), stock: nextStock, status: nextStatus });

          const imgs = parseJsonArray<string>(prod.images_json, []);
          preparedItems.push({
            productId: String(prod.id),
            sellerId: String(prod.seller_id),
            title: String(prod.title),
            image: imgs[0] || '',
            unitPrice,
            quantity: qty,
            negotiatedFrom,
          });
          notifiedSellers.add(String(prod.seller_id));
        }

        db.prepare(
          `INSERT INTO orders (id, buyer_id, status, total_amount, shipping_name, shipping_address, shipping_city, shipping_postal, payment_method, tracking_code, created_at, updated_at)
           VALUES (?, ?, 'Placed', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          orderId,
          req.user!.userId,
          totalAmount,
          String(shippingName).trim(),
          String(shippingAddress).trim(),
          String(shippingCity).trim(),
          String(shippingPostal).trim(),
          String(paymentMethod || 'Heritage Escrow Card'),
          trackingCode,
          now,
          now
        );

        const insertItem = db.prepare(
          `INSERT INTO order_items (id, order_id, product_id, seller_id, title, image, unit_price, quantity, negotiated_from)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const item of preparedItems) {
          insertItem.run(
            genId('oi'),
            orderId,
            item.productId,
            item.sellerId,
            item.title,
            item.image,
            item.unitPrice,
            item.quantity,
            item.negotiatedFrom
          );
          // Remove from wishlist if purchased
          db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(
            req.user!.userId,
            item.productId
          );
        }

        return { totalAmount, notifiedSellers: Array.from(notifiedSellers), stockChanges };
      })();

      for (const sc of result.stockChanges) {
        broadcastAll('stock:updated', sc);
      }

      for (const sellerId of result.notifiedSellers) {
        createNotification(
          sellerId,
          'order',
          `New Order ${orderId}`,
          `A buyer placed an order (${orderId}) from your archive. Please prepare authentication & dispatch.`,
          'store'
        );
        pushToUser(sellerId, 'order:updated', { orderId, status: 'Placed' });
      }

      createNotification(
        req.user!.userId,
        'order',
        `Order ${orderId} Confirmed`,
        `Tracking ${trackingCode} assigned. Total: $${result.totalAmount.toLocaleString()}.`,
        'orders'
      );

      res.status(201).json({ orderId, trackingCode, totalAmount: result.totalAmount });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
    }
  });

  app.get('/api/orders', requireAuth, (req: AuthedRequest, res: Response) => {
    const scope = req.query.scope;
    let orderRows: Array<Record<string, unknown>> = [];

    if (scope === 'seller') {
      orderRows = db
        .prepare(
          `SELECT DISTINCT o.*, u.name as buyer_name
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           JOIN users u ON u.id = o.buyer_id
           WHERE oi.seller_id = ?
           ORDER BY o.created_at DESC`
        )
        .all(req.user!.userId) as Array<Record<string, unknown>>;
    } else {
      orderRows = db
        .prepare(
          `SELECT o.*, u.name as buyer_name
           FROM orders o JOIN users u ON u.id = o.buyer_id
           WHERE o.buyer_id = ?
           ORDER BY o.created_at DESC`
        )
        .all(req.user!.userId) as Array<Record<string, unknown>>;
    }

    const hydrated = orderRows.map((o) => {
      const items = db
        .prepare(
          `SELECT oi.*, u.store_name as seller_store_name, u.name as seller_name
           FROM order_items oi JOIN users u ON u.id = oi.seller_id
           WHERE oi.order_id = ?`
        )
        .all(String(o.id)) as Array<Record<string, unknown>>;

      return {
        id: String(o.id),
        buyer_id: String(o.buyer_id),
        buyer_name: String(o.buyer_name),
        status: String(o.status),
        total_amount: Number(o.total_amount),
        shipping_name: String(o.shipping_name),
        shipping_address: String(o.shipping_address),
        shipping_city: String(o.shipping_city),
        shipping_postal: String(o.shipping_postal),
        payment_method: String(o.payment_method),
        tracking_code: String(o.tracking_code),
        created_at: String(o.created_at),
        updated_at: String(o.updated_at),
        items: items.map((it) => {
          const rev = db
            .prepare('SELECT id FROM reviews WHERE order_id = ? AND product_id = ? AND reviewer_id = ?')
            .get(String(o.id), String(it.product_id), req.user!.userId);
          return {
            id: String(it.id),
            order_id: String(it.order_id),
            product_id: String(it.product_id),
            seller_id: String(it.seller_id),
            seller_store_name: String(it.seller_store_name || it.seller_name),
            title: String(it.title),
            image: String(it.image),
            unit_price: Number(it.unit_price),
            quantity: Number(it.quantity),
            negotiated_from: it.negotiated_from !== null ? Number(it.negotiated_from) : null,
            has_review: Boolean(rev),
          };
        }),
      };
    });

    res.json({ orders: hydrated });
  });

  app.patch('/api/orders/:id/status', requireAuth, (req: AuthedRequest, res: Response) => {
    const { status } = req.body || {};
    if (!['Placed', 'Authenticated', 'Shipped', 'Delivered', 'Cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid order status' });
      return;
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const ownsItem = db
      .prepare('SELECT id FROM order_items WHERE order_id = ? AND seller_id = ? LIMIT 1')
      .get(req.params.id, req.user!.userId);

    if (!ownsItem && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only the fulfilling seller or admin can update shipment status' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id);

    createNotification(
      String(order.buyer_id),
      'order',
      `Order ${String(order.id)} — ${status}`,
      `Your order status updated to ${status} (Tracking: ${String(order.tracking_code)}).`,
      'orders'
    );
    pushToUser(String(order.buyer_id), 'order:updated', { orderId: order.id, status });

    res.json({ updated: true, status });
  });

  // ------------------------------------------------------------------
  // VERIFIED TRANSACTION REVIEWS
  // ------------------------------------------------------------------
  app.post('/api/reviews', requireAuth, (req: AuthedRequest, res: Response) => {
    const { orderId, productId, rating, comment } = req.body || {};
    if (!orderId || !productId || !rating || !comment) {
      res.status(400).json({ error: 'Order, product, rating, and comment are required' });
      return;
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND buyer_id = ?').get(orderId, req.user!.userId) as
      | Record<string, unknown>
      | undefined;
    if (!order) {
      res.status(403).json({ error: 'Verified purchase record not found for your account' });
      return;
    }
    if (order.status !== 'Delivered') {
      res.status(400).json({ error: 'Verified reviews can be submitted once the order is marked Delivered' });
      return;
    }

    const item = db
      .prepare('SELECT seller_id FROM order_items WHERE order_id = ? AND product_id = ?')
      .get(orderId, productId) as { seller_id: string } | undefined;
    if (!item) {
      res.status(400).json({ error: 'Product not part of this order' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM reviews WHERE order_id = ? AND product_id = ? AND reviewer_id = ?')
      .get(orderId, productId, req.user!.userId);
    if (existing) {
      res.status(409).json({ error: 'You have already reviewed this piece for this order' });
      return;
    }

    const id = genId('rev');
    const createdAt = new Date().toISOString();
    const numRating = Math.min(5, Math.max(1, Math.round(Number(rating))));

    db.prepare(
      `INSERT INTO reviews (id, order_id, product_id, seller_id, reviewer_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, orderId, productId, item.seller_id, req.user!.userId, numRating, String(comment).trim(), createdAt);

    createNotification(
      item.seller_id,
      'review',
      `New ${numRating}-Star Verified Review`,
      `"${String(comment).trim().slice(0, 90)}"`,
      'store'
    );

    res.status(201).json({ reviewId: id });
  });

  // ------------------------------------------------------------------
  // OUTFIT INSPIRATION LOOKBOOKS
  // ------------------------------------------------------------------
  app.get('/api/lookbooks', (_req: Request, res: Response) => {
    const rows = db
      .prepare(
        `SELECT l.*, u.name as author_name, u.store_name as author_store_name
         FROM lookbooks l JOIN users u ON u.id = l.author_id
         ORDER BY l.created_at DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const lookbooks = rows.map((r) => {
      const productIds = parseJsonArray<string>(r.product_ids_json, []);
      const products: ReturnType<typeof hydrateProduct>[] = [];
      for (const pid of productIds) {
        const pRow = db
          .prepare(
            `SELECT p.*, u.name as seller_name, u.store_name as seller_store_name, u.store_location as seller_location, u.badges_json as seller_badges_json
             FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = ?`
          )
          .get(pid) as Record<string, unknown> | undefined;
        if (pRow) products.push(hydrateProduct(pRow));
      }
      return {
        id: String(r.id),
        author_id: String(r.author_id),
        author_name: String(r.author_name),
        author_store_name: String(r.author_store_name || r.author_name),
        title: String(r.title),
        season: String(r.season),
        story: String(r.story),
        cover_image: String(r.cover_image),
        product_ids: productIds,
        products,
        likes_count: Number(r.likes_count),
        created_at: String(r.created_at),
      };
    });

    res.json({ lookbooks });
  });

  app.post('/api/lookbooks', requireAuth, (req: AuthedRequest, res: Response) => {
    const { title, season, story, coverImage, productIds } = req.body || {};
    if (!title || !story) {
      res.status(400).json({ error: 'Lookbook title and styling notes are required' });
      return;
    }
    const id = genId('look');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO lookbooks (id, author_id, title, season, story, cover_image, product_ids_json, likes_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      id,
      req.user!.userId,
      String(title).trim(),
      String(season || 'Curated Archive').trim(),
      String(story).trim(),
      String(coverImage || '/src/assets/images/lookbook_autumn_heritage_1795191632933.jpg'),
      JSON.stringify(Array.isArray(productIds) ? productIds.slice(0, 6) : []),
      now
    );
    res.status(201).json({ lookbookId: id });
  });

  app.post('/api/lookbooks/:id/like', (_req: Request, res: Response) => {
    db.prepare('UPDATE lookbooks SET likes_count = likes_count + 1 WHERE id = ?').run(_req.params.id);
    const updated = db.prepare('SELECT likes_count FROM lookbooks WHERE id = ?').get(_req.params.id) as
      | { likes_count: number }
      | undefined;
    res.json({ likes_count: updated?.likes_count ?? 0 });
  });

  // ------------------------------------------------------------------
  // NOTIFICATIONS
  // ------------------------------------------------------------------
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(req.user!.userId) as Array<Record<string, unknown>>;

    res.json({
      notifications: rows.map((r) => ({
        ...r,
        is_read: Boolean(r.is_read),
      })),
    });
  });

  app.patch('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.userId);
    res.json({ updated: true });
  });

  // ------------------------------------------------------------------
  // REPORTS & ADMIN MODERATION DASHBOARD
  // ------------------------------------------------------------------
  app.post('/api/reports', requireAuth, (req: AuthedRequest, res: Response) => {
    const { targetType, targetId, reason } = req.body || {};
    if (!targetType || !targetId || !reason) {
      res.status(400).json({ error: 'Target and reason are required' });
      return;
    }
    const id = genId('rep');
    db.prepare(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, admin_notes, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', '', ?)`
    ).run(id, req.user!.userId, targetType === 'user' ? 'user' : 'product', String(targetId), String(reason).trim(), new Date().toISOString());

    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as Array<{ id: string }>;
    for (const a of admins) {
      createNotification(a.id, 'admin', 'New Moderation Report', String(reason).trim().slice(0, 100), 'admin');
    }

    res.status(201).json({ reportId: id });
  });

  app.get('/api/admin/overview', requireAuth, requireRole('admin'), (_req: AuthedRequest, res: Response) => {
    const users = (db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as Array<Record<string, unknown>>).map(
      sanitizeUser
    );
    const products = (
      db
        .prepare(
          `SELECT p.*, u.name as seller_name, u.store_name as seller_store_name, u.store_location as seller_location, u.badges_json as seller_badges_json
           FROM products p JOIN users u ON u.id = p.seller_id ORDER BY p.created_at DESC`
        )
        .all() as Array<Record<string, unknown>>
    ).map(hydrateProduct);

    const reportsRaw = db
      .prepare(
        `SELECT r.*, u.name as reporter_name
         FROM reports r JOIN users u ON u.id = r.reporter_id
         ORDER BY r.created_at DESC`
      )
      .all() as Array<Record<string, unknown>>;

    const reports = reportsRaw.map((r) => {
      let targetLabel = String(r.target_id);
      if (r.target_type === 'product') {
        const p = db.prepare('SELECT title FROM products WHERE id = ?').get(String(r.target_id)) as
          | { title: string }
          | undefined;
        if (p) targetLabel = p.title;
      } else {
        const u = db.prepare('SELECT name FROM users WHERE id = ?').get(String(r.target_id)) as
          | { name: string }
          | undefined;
        if (u) targetLabel = u.name;
      }
      return { ...r, target_label: targetLabel };
    });

    const orderStats = db
      .prepare("SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as gmv FROM orders WHERE status != 'Cancelled'")
      .get() as { total_orders: number; gmv: number };

    const bartersCount = (
      db.prepare("SELECT COUNT(*) as c FROM barter_offers WHERE status = 'accepted'").get() as { c: number }
    ).c;

    res.json({
      stats: {
        totalUsers: users.length,
        activeListings: products.filter((p) => p.status === 'active').length,
        flaggedListings: products.filter((p) => p.status === 'flagged').length,
        openReports: reports.filter((r) => (r as Record<string, unknown>).status === 'open').length,
        totalOrders: orderStats.total_orders,
        gmv: orderStats.gmv,
        completedBarters: bartersCount,
      },
      users,
      products,
      reports,
    });
  });

  app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res: Response) => {
    const { role, badges, is_suspended } = req.body || {};
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const nextRole = role && ['buyer', 'seller', 'admin'].includes(role) ? role : String(target.role);
    const nextBadges = Array.isArray(badges) ? JSON.stringify(badges) : String(target.badges_json);
    const nextSuspended = is_suspended !== undefined ? (is_suspended ? 1 : 0) : Number(target.is_suspended);

    db.prepare('UPDATE users SET role = ?, badges_json = ?, is_suspended = ? WHERE id = ?').run(
      nextRole,
      nextBadges,
      nextSuspended,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({ user: sanitizeUser(updated) });
  });

  app.patch('/api/admin/products/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res: Response) => {
    const { status, featured } = req.body || {};
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!prod) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const nextStatus = status && ['active', 'flagged', 'sold_out', 'archived'].includes(status) ? status : String(prod.status);
    const nextFeatured = featured !== undefined ? (featured ? 1 : 0) : Number(prod.featured);

    db.prepare('UPDATE products SET status = ?, featured = ? WHERE id = ?').run(nextStatus, nextFeatured, req.params.id);
    if (nextStatus === 'flagged') {
      createNotification(
        String(prod.seller_id),
        'admin',
        'Listing Flagged by Moderation',
        `"${String(prod.title)}" has been paused for authenticity/policy review.`,
        'store'
      );
    }
    res.json({ updated: true, status: nextStatus, featured: Boolean(nextFeatured) });
  });

  app.patch('/api/admin/reports/:id', requireAuth, requireRole('admin'), (req: AuthedRequest, res: Response) => {
    const { status, adminNotes } = req.body || {};
    if (!['resolved', 'dismissed', 'open'].includes(status)) {
      res.status(400).json({ error: 'Invalid report status' });
      return;
    }
    db.prepare('UPDATE reports SET status = ?, admin_notes = ? WHERE id = ?').run(
      status,
      String(adminNotes || '').trim(),
      req.params.id
    );
    res.json({ updated: true });
  });

  // ------------------------------------------------------------------
  // VITE / STATIC SERVING
  // ------------------------------------------------------------------
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`JAZMINE Boutique Server running at http://localhost:${PORT}`);
  });
}

startServer();
