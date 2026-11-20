import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Heart,
  ShoppingBag,
  Bell,
  MessageSquare,
  Package,
  Store,
  Repeat,
  BookOpen,
  Shield,
  LogOut,
  Award,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch, getAuthToken, setAuthToken } from './lib/api';
import { PWAInstallButton, OfflineIndicator } from './hooks/usePWAInstall';
import { SafeImage } from './components/SafeImage';
import { AuthModal } from './components/AuthModal';
import { ProductModal } from './components/ProductModal';
import { CartDrawer } from './components/CartDrawer';
import { BarterRoom } from './components/BarterRoom';
import { MessagesView } from './components/MessagesView';
import { StoreDashboard } from './components/StoreDashboard';
import { OrdersView } from './components/OrdersView';
import { LookbookView } from './components/LookbookView';
import { AdminDashboard } from './components/AdminDashboard';
import type { CartItem, NotificationItem, Product, User } from './types';

type ActiveTab =
  | 'marketplace'
  | 'barter'
  | 'lookbook'
  | 'store'
  | 'messages'
  | 'orders'
  | 'admin';

const CATEGORIES = ['All', 'Outerwear', 'Handbags', 'Accessories', 'Footwear', 'Tailoring', 'Jewelry'];
const CONDITIONS = ['All', 'Archival Mint', 'Excellent Pre-Loved', 'Gently Worn'];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('marketplace');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setTokenState] = useState<string | null>(getAuthToken());

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [barterOnly, setBarterOnly] = useState(false);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured');

  // Modals & Drawers
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('jazmine_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Cross-view triggers
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [barterTargetProduct, setBarterTargetProduct] = useState<Product | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const notifyToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    try {
      localStorage.setItem('jazmine_cart', JSON.stringify(cartItems));
    } catch {
      // ignore storage quota
    }
  }, [cartItems]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiFetch<{ products: Product[] }>('/api/products');
      setProducts(res.products || []);
    } catch {
      // keep existing if offline
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchUserContext = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUser(null);
      setWishlistIds([]);
      setNotifications([]);
      return;
    }
    try {
      const [meRes, wishRes, notifRes] = await Promise.all([
        apiFetch<{ user: User }>('/api/auth/me'),
        apiFetch<{ productIds: string[] }>('/api/wishlists'),
        apiFetch<{ notifications: NotificationItem[] }>('/api/notifications'),
      ]);
      setCurrentUser(meRes.user);
      setWishlistIds(wishRes.productIds || []);
      setNotifications(notifRes.notifications || []);
    } catch {
      setAuthToken(null);
      setTokenState(null);
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchUserContext();
  }, [fetchProducts, fetchUserContext]);

  // Real-time WebSocket connection
  useEffect(() => {
    if (!authToken) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws?token=${encodeURIComponent(authToken)}`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const { event, payload } = JSON.parse(evt.data);
          if (event === 'stock:updated' && payload?.productId) {
            setProducts((prev) =>
              prev.map((p) =>
                p.id === payload.productId
                  ? { ...p, stock: payload.stock, status: payload.status }
                  : p
              )
            );
          } else if (event === 'notification:new' && payload) {
            setNotifications((prev) => [payload, ...prev.filter((n) => n.id !== payload.id)]);
            setRefreshSignal((s) => s + 1);
            notifyToast(`${payload.title}`);
          } else if (
            event === 'message:new' ||
            event === 'offer:updated' ||
            event === 'barter:updated' ||
            event === 'order:updated'
          ) {
            setRefreshSignal((s) => s + 1);
          }
        } catch {
          // ignore malformed ws frame
        }
      };
      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [authToken, notifyToast]);

  const handleAuthenticated = (user: User, token: string) => {
    setCurrentUser(user);
    setTokenState(token);
    fetchUserContext();
    fetchProducts();
    notifyToast(`Welcome to JAZMINE, ${user.name}.`);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setTokenState(null);
    setCurrentUser(null);
    setWishlistIds([]);
    setNotifications([]);
    if (activeTab === 'admin' || activeTab === 'store' || activeTab === 'messages' || activeTab === 'orders') {
      setActiveTab('marketplace');
    }
    notifyToast('Signed out of JAZMINE.');
  };

  const handleToggleWishlist = async (productId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    try {
      const res = await apiFetch<{ saved: boolean }>(`/api/wishlists/${productId}`, {
        method: 'POST',
      });
      setWishlistIds((prev) =>
        res.saved ? [...prev, productId] : prev.filter((id) => id !== productId)
      );
      notifyToast(res.saved ? 'Saved to your wishlist.' : 'Removed from wishlist.');
    } catch (err) {
      notifyToast(err instanceof Error ? err.message : 'Wishlist update failed');
    }
  };

  const handleAddToCart = (product: Product, agreedPrice?: number) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(product.stock, existing.quantity + 1);
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: nextQty, agreedPrice: agreedPrice ?? i.agreedPrice }
            : i
        );
      }
      return [...prev, { product, quantity: 1, agreedPrice }];
    });
  };

  const handleUpdateCartQty = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const next = Math.min(item.product.stock, item.quantity + delta);
          return next <= 0 ? null : { ...item, quantity: next };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const handleStartNegotiation = async (product: Product) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    try {
      const res = await apiFetch<{ conversationId: string }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ sellerId: product.seller_id, productId: product.id }),
      });
      setSelectedProduct(null);
      setActiveConversationId(res.conversationId);
      setActiveTab('messages');
    } catch (err) {
      notifyToast(err instanceof Error ? err.message : 'Could not open inquiry');
    }
  };

  const handleMarkNotificationsRead = async () => {
    if (!currentUser) return;
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // ignore
    }
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (selectedCondition !== 'All') {
      list = list.filter((p) => p.condition === selectedCondition);
    }
    if (barterOnly) {
      list = list.filter((p) => p.allow_barter);
    }
    if (wishlistOnly) {
      list = list.filter((p) => wishlistIds.includes(p.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.seller_store_name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else {
      list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return list;
  }, [
    products,
    selectedCategory,
    selectedCondition,
    barterOnly,
    wishlistOnly,
    wishlistIds,
    searchQuery,
    sortBy,
  ]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-[#F9F6F0] pb-20 text-[#3B281E] md:pb-0">
      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-40 border-b border-[#D8CEBA] bg-[#F9F6F0]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className="font-serif-editorial text-2xl font-semibold tracking-[0.14em] text-[#3B281E] whitespace-nowrap shrink-0 cursor-pointer"
          >
            JAZMINE
          </button>

          {/* Zone 2: 4–5 single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#6E5B4F]">
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'marketplace'
                  ? 'border-b border-[#6D2932] text-[#3B281E]'
                  : 'hover:text-[#3B281E]'
              }`}
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('barter')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'barter'
                  ? 'border-b border-[#6D2932] text-[#3B281E]'
                  : 'hover:text-[#3B281E]'
              }`}
            >
              Barter Room
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lookbook')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'lookbook'
                  ? 'border-b border-[#6D2932] text-[#3B281E]'
                  : 'hover:text-[#3B281E]'
              }`}
            >
              Lookbook
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'store'
                  ? 'border-b border-[#6D2932] text-[#3B281E]'
                  : 'hover:text-[#3B281E]'
              }`}
            >
              My Store
            </button>
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'border-b border-[#6D2932] text-[#6D2932]'
                    : 'hover:text-[#6D2932]'
                }`}
              >
                Admin
              </button>
            )}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="shrink-0">
            {currentUser ? (
              <button
                type="button"
                onClick={() => setShowCartDrawer(true)}
                className="inline-flex items-center gap-2 bg-[#3B281E] px-4 py-2 text-xs font-medium uppercase tracking-wider text-[#F9F6F0] transition-colors hover:bg-[#6D2932] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-[#B08D57]" />
                <span className="tabular-nums">Bag ({cartCount})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="bg-[#6D2932] px-4 py-2 text-xs font-medium uppercase tracking-wider text-[#F9F6F0] transition-colors hover:bg-[#561E26] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Workspace Concierge Sub-Bar (Member Account, Inbox, Orders, Notifications, PWA Install) */}
      <div className="border-b border-[#D8CEBA] bg-[#EFE9DD]/70">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#6E5B4F]">
            {currentUser ? (
              <>
                <span className="font-semibold text-[#3B281E]">
                  {currentUser.name}
                  <span className="ml-1.5 font-normal text-[#6E5B4F]">
                    · {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
                  </span>
                </span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('messages')}
                  className={`inline-flex items-center gap-1.5 hover:text-[#3B281E] whitespace-nowrap cursor-pointer ${
                    activeTab === 'messages' ? 'font-semibold text-[#6D2932]' : ''
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Messages
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`inline-flex items-center gap-1.5 hover:text-[#3B281E] whitespace-nowrap cursor-pointer ${
                    activeTab === 'orders' ? 'font-semibold text-[#6D2932]' : ''
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  Orders
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWishlistOnly((v) => !v);
                    setActiveTab('marketplace');
                  }}
                  className={`inline-flex items-center gap-1.5 hover:text-[#3B281E] whitespace-nowrap cursor-pointer ${
                    wishlistOnly && activeTab === 'marketplace' ? 'font-semibold text-[#6D2932]' : ''
                  }`}
                >
                  <Heart className="h-3.5 w-3.5" />
                  <span className="tabular-nums">Wishlist ({wishlistIds.length})</span>
                </button>
              </>
            ) : (
              <span className="text-xs text-[#6E5B4F]">
                Good Style Deserves a Second Life · Curated Pre-Loved Archive &amp; Barter Salon
              </span>
            )}
          </div>

          <div className="relative flex items-center gap-3">
            <PWAInstallButton compact />

            {currentUser ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifPanel((v) => !v);
                    if (!showNotifPanel && unreadCount > 0) handleMarkNotificationsRead();
                  }}
                  aria-label="Notifications"
                  className="relative inline-flex items-center gap-1.5 border border-[#D8CEBA] bg-white px-2.5 py-1.5 text-xs font-medium text-[#3B281E] hover:border-[#6D2932] cursor-pointer"
                >
                  <Bell className="h-3.5 w-3.5 text-[#6D2932]" />
                  <span className="tabular-nums">{unreadCount}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#6E5B4F] hover:text-[#6D2932] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowCartDrawer(true)}
                className="inline-flex items-center gap-1.5 border border-[#D8CEBA] bg-white px-3 py-1.5 text-xs font-medium text-[#3B281E] cursor-pointer"
              >
                <ShoppingBag className="h-3.5 w-3.5 text-[#6D2932]" />
                <span className="tabular-nums">Bag ({cartCount})</span>
              </button>
            )}

            {/* Notifications Dropdown */}
            {showNotifPanel && currentUser && (
              <div className="absolute right-0 top-10 z-50 w-80 border border-[#D8CEBA] bg-[#F9F6F0] p-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#D8CEBA] pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#3B281E]">
                    Atelier Alerts
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNotifPanel(false)}
                    className="text-xs text-[#6E5B4F] hover:text-[#3B281E] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#6E5B4F]">No new notifications.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setShowNotifPanel(false);
                          if (
                            ['marketplace', 'barter', 'lookbook', 'store', 'messages', 'orders', 'admin'].includes(
                              n.link_tab
                            )
                          ) {
                            setActiveTab(n.link_tab as ActiveTab);
                          }
                        }}
                        className="block w-full border border-[#D8CEBA] bg-white p-2.5 text-left hover:border-[#6D2932] cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-[#3B281E]">{n.title}</p>
                        <p className="mt-0.5 text-xs text-[#6E5B4F]">{n.body}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Route Switch */}
      <main>
        {activeTab === 'marketplace' && (
          <>
            {/* Storefront Hero Split */}
            <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-10">
              <div className="grid grid-cols-1 items-stretch border border-[#D8CEBA] bg-white lg:grid-cols-12">
                <div className="flex flex-col justify-between p-8 sm:p-12 lg:col-span-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#B08D57]">
                      Curated Pre-Loved Luxury &amp; Barter
                    </p>
                    <h1
                      className="mt-3 font-serif-editorial text-4xl font-semibold leading-[1.08] text-[#3B281E] sm:text-5xl"
                      style={{ textWrap: 'balance' }}
                    >
                      Good Style Deserves a Second Life.
                    </h1>
                    <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#6E5B4F] sm:text-base">
                      Discover authenticated heirloom tailoring, vintage calfskin leather, and
                      archival silk from independent ateliers. Purchase outright, negotiate directly
                      with curators, or trade in The Barter Room.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <a
                      href="#atelier-catalog"
                      className="bg-[#6D2932] px-6 py-3.5 text-xs font-medium uppercase tracking-widest text-[#F9F6F0] transition-colors hover:bg-[#561E26]"
                    >
                      Explore the Archive
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab('barter')}
                      className="border border-[#3B281E] bg-transparent px-5 py-3.5 text-xs font-medium uppercase tracking-widest text-[#3B281E] transition-colors hover:bg-[#3B281E] hover:text-[#F9F6F0] cursor-pointer"
                    >
                      Enter Barter Room
                    </button>
                  </div>
                </div>

                <div className="aspect-[16/10] overflow-hidden bg-[#EFE9DD] lg:col-span-6 lg:aspect-auto">
                  <SafeImage
                    src="/src/assets/images/hero_atelier_showcase_1795191633012.jpg"
                    alt="JAZMINE Vintage Boutique Showroom"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </section>

            {/* Search & Filter Toolbar */}
            <section
              id="atelier-catalog"
              className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8"
            >
              <div className="flex flex-col gap-4 border-b border-[#D8CEBA] pb-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  {/* Search */}
                  <div className="relative w-full lg:max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E5B4F]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search maison, piece, fabric, or atelier..."
                      className="h-11 w-full border border-[#D8CEBA] bg-white pl-10 pr-4 text-sm text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                    />
                  </div>

                  {/* Secondary Filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#6E5B4F]">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-[#B08D57]" />
                      <select
                        value={selectedCondition}
                        onChange={(e) => setSelectedCondition(e.target.value)}
                        aria-label="Filter by condition"
                        className="h-10 border border-[#D8CEBA] bg-white px-3 text-xs font-medium text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c} value={c}>
                            {c === 'All' ? 'All Conditions' : c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      aria-label="Sort listings"
                      className="h-10 border border-[#D8CEBA] bg-white px-3 text-xs font-medium text-[#3B281E] focus:border-[#6D2932] focus:outline-none"
                    >
                      <option value="featured">Curatorial Order</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setBarterOnly((v) => !v)}
                      className={`h-10 border px-3.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        barterOnly
                          ? 'border-[#6D2932] bg-[#6D2932] text-[#F9F6F0]'
                          : 'border-[#D8CEBA] bg-white text-[#3B281E] hover:border-[#6D2932]'
                      }`}
                    >
                      Barter Eligible
                    </button>
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 text-xs font-medium tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#3B281E] text-[#F9F6F0]'
                          : 'border border-[#D8CEBA] bg-[#EFE9DD]/70 text-[#3B281E] hover:bg-[#EFE9DD]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  {wishlistOnly && (
                    <button
                      type="button"
                      onClick={() => setWishlistOnly(false)}
                      className="ml-auto border border-[#6D2932] bg-[#6D2932]/10 px-3 py-2 text-xs font-medium text-[#6D2932] whitespace-nowrap cursor-pointer"
                    >
                      Viewing Wishlist · Clear
                    </button>
                  )}
                </div>
              </div>

              {/* 3-Column Product Grid */}
              {loadingProducts ? (
                <div className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-96 animate-pulse border border-[#D8CEBA] bg-[#EFE9DD]" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="my-10 border border-[#D8CEBA] bg-white p-12 text-center">
                  <p className="font-serif-editorial text-2xl text-[#3B281E]">
                    No archive pieces match your current selection
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setSelectedCondition('All');
                      setBarterOnly(false);
                      setWishlistOnly(false);
                    }}
                    className="mt-4 border border-[#3B281E] px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-[#3B281E] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-7 py-8 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const isWishlisted = wishlistIds.includes(product.id);
                    const isSoldOut = product.stock <= 0 || product.status === 'sold_out';
                    return (
                      <article
                        key={product.id}
                        className="group flex flex-col justify-between border border-[#D8CEBA] bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div>
                          <div className="relative aspect-[4/3] overflow-hidden bg-[#EFE9DD]">
                            <button
                              type="button"
                              onClick={() => setSelectedProduct(product)}
                              className="block h-full w-full cursor-pointer"
                            >
                              <SafeImage
                                src={product.images[0]}
                                alt={product.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleWishlist(product.id)}
                              aria-label="Toggle wishlist"
                              className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center border transition-colors cursor-pointer ${
                                isWishlisted
                                  ? 'border-[#6D2932] bg-[#6D2932] text-[#F9F6F0]'
                                  : 'border-[#D8CEBA] bg-[#F9F6F0]/90 text-[#3B281E] hover:border-[#6D2932]'
                              }`}
                            >
                              <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
                            </button>
                          </div>

                          <div className="p-5">
                            <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-widest text-[#6E5B4F]">
                              <span className="truncate">
                                {product.brand} · {product.size}
                              </span>
                              <span className="shrink-0 font-medium text-[#6D2932]">
                                {isSoldOut
                                  ? 'Sold Out'
                                  : product.allow_barter
                                  ? 'Barter Open'
                                  : product.condition}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedProduct(product)}
                              className="mt-1.5 block text-left cursor-pointer"
                            >
                              <h3 className="font-serif-editorial text-2xl font-semibold leading-snug text-[#3B281E] group-hover:text-[#6D2932]">
                                {product.title}
                              </h3>
                            </button>

                            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#6E5B4F]">
                              <span>{product.seller_store_name}</span>
                              {product.seller_badges.includes('Verified Archivist') && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 text-[#3B281E]">
                                    <Award className="h-3.5 w-3.5 text-[#B08D57]" />
                                    Verified
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-[#D8CEBA] px-5 py-3.5">
                          <div className="flex items-baseline gap-2 tabular-nums">
                            <span className="text-base font-semibold text-[#3B281E]">
                              ${product.price.toLocaleString()}
                            </span>
                            {product.original_price > product.price && (
                              <span className="text-xs text-[#6E5B4F] line-through">
                                ${product.original_price.toLocaleString()}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedProduct(product)}
                            className="text-xs font-medium uppercase tracking-wider text-[#6D2932] hover:underline cursor-pointer"
                          >
                            {isSoldOut ? 'View Archive' : `Inspect (${product.stock} left)`}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'barter' && (
          <BarterRoom
            currentUser={currentUser}
            products={products}
            initialTarget={barterTargetProduct}
            onClearInitialTarget={() => setBarterTargetProduct(null)}
            onRequireAuth={() => setShowAuthModal(true)}
            onRefreshData={fetchProducts}
            onNotifyToast={notifyToast}
            refreshSignal={refreshSignal}
          />
        )}

        {activeTab === 'lookbook' && (
          <LookbookView
            currentUser={currentUser}
            products={products}
            onSelectProduct={(p) => setSelectedProduct(p)}
            onRequireAuth={() => setShowAuthModal(true)}
            onNotifyToast={notifyToast}
          />
        )}

        {activeTab === 'store' && (
          <StoreDashboard
            currentUser={currentUser}
            onRequireAuth={() => setShowAuthModal(true)}
            onUserUpdated={handleAuthenticated}
            onRefreshProducts={fetchProducts}
            onNotifyToast={notifyToast}
            refreshSignal={refreshSignal}
          />
        )}

        {activeTab === 'messages' && (
          <MessagesView
            currentUser={currentUser}
            activeConversationId={activeConversationId}
            products={products}
            onSelectConversation={setActiveConversationId}
            onAddNegotiatedToCart={(prod, agreedPrice) => {
              handleAddToCart(prod, agreedPrice);
              setShowCartDrawer(true);
            }}
            onRequireAuth={() => setShowAuthModal(true)}
            onNotifyToast={notifyToast}
            refreshSignal={refreshSignal}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersView
            currentUser={currentUser}
            onRequireAuth={() => setShowAuthModal(true)}
            onNotifyToast={notifyToast}
            refreshSignal={refreshSignal}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            currentUser={currentUser}
            onRefreshProducts={fetchProducts}
            onNotifyToast={notifyToast}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="mt-16 border-t border-[#D8CEBA] bg-[#EFE9DD]/60 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <span className="font-serif-editorial text-xl font-semibold tracking-[0.14em] text-[#3B281E]">
              JAZMINE
            </span>
            <p className="mt-1 text-xs text-[#6E5B4F]">
              Good Style Deserves a Second Life · Authenticated Luxury Resale &amp; Barter
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-[#6E5B4F]">
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className="hover:text-[#3B281E] cursor-pointer"
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('barter')}
              className="hover:text-[#3B281E] cursor-pointer"
            >
              Barter Room
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lookbook')}
              className="hover:text-[#3B281E] cursor-pointer"
            >
              Lookbook
            </button>
            <PWAInstallButton />
          </div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Thumb Navigation Bar (5 Tabs, Compact 60px) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D8CEBA] bg-[#F9F6F0]/95 backdrop-blur-md md:hidden pb-safe"
      >
        <div className="grid h-15 grid-cols-5 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'marketplace' ? 'text-[#6D2932]' : 'text-[#6E5B4F]'
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="text-[10px] font-medium">Shop</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('barter')}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'barter' ? 'text-[#6D2932]' : 'text-[#6E5B4F]'
            }`}
          >
            <Repeat className="h-5 w-5" />
            <span className="text-[10px] font-medium">Barter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lookbook')}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'lookbook' ? 'text-[#6D2932]' : 'text-[#6E5B4F]'
            }`}
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-[10px] font-medium">Looks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeTab === 'messages' ? 'text-[#6D2932]' : 'text-[#6E5B4F]'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-medium">Inbox</span>
          </button>

          {currentUser?.role === 'admin' ? (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 cursor-pointer ${
                activeTab === 'admin' ? 'text-[#6D2932]' : 'text-[#6E5B4F]'
              }`}
            >
              <Shield className="h-5 w-5" />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 cursor-pointer ${
                activeTab === 'store' ? 'text-[#6D2932]' : 'text-[#6E5B4F]'
              }`}
            >
              <Store className="h-5 w-5" />
              <span className="text-[10px] font-medium">My Store</span>
            </button>
          )}
        </div>
      </nav>

      {/* Modals & Drawers */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthenticated}
      />

      <ProductModal
        product={selectedProduct}
        currentUser={currentUser}
        isWishlisted={selectedProduct ? wishlistIds.includes(selectedProduct.id) : false}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(p) => handleAddToCart(p)}
        onToggleWishlist={handleToggleWishlist}
        onStartNegotiation={handleStartNegotiation}
        onProposeBarter={(p) => {
          setSelectedProduct(null);
          setBarterTargetProduct(p);
          setActiveTab('barter');
        }}
        onRequireAuth={() => setShowAuthModal(true)}
        onNotifyToast={notifyToast}
      />

      <CartDrawer
        isOpen={showCartDrawer}
        items={cartItems}
        currentUser={currentUser}
        onClose={() => setShowCartDrawer(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={(id) => setCartItems((prev) => prev.filter((i) => i.product.id !== id))}
        onClearCart={() => setCartItems([])}
        onRequireAuth={() => setShowAuthModal(true)}
        onOrderSuccess={() => {
          fetchProducts();
          setRefreshSignal((s) => s + 1);
          setActiveTab('orders');
        }}
      />

      <OfflineIndicator />

      {/* Subtle Toast Feedback */}
      {toast && (
        <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 border border-[#B08D57] bg-[#3B281E] px-4 py-3 text-xs font-medium text-[#F9F6F0] shadow-xl md:bottom-6">
          <Check className="h-3.5 w-3.5 text-[#B08D57]" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
