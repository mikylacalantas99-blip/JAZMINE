import React, { useEffect, useState } from 'react';
import { ShieldAlert, Award, Check, Flag, Star } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SafeImage } from './SafeImage';
import type { Product, ReportItem, User, UserRole } from '../types';

interface AdminDashboardProps {
  currentUser: User | null;
  onRefreshProducts: () => void;
  onNotifyToast: (msg: string) => void;
}

interface AdminOverview {
  stats: {
    totalUsers: number;
    activeListings: number;
    flaggedListings: number;
    openReports: number;
    totalOrders: number;
    gmv: number;
    completedBarters: number;
  };
  users: User[];
  products: Product[];
  reports: ReportItem[];
}

const AVAILABLE_BADGES = ['Verified Archivist', 'Heritage Curator', 'Fast Shipper', 'Trusted Seller'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onRefreshProducts,
  onNotifyToast,
}) => {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<'listings' | 'reports' | 'members'>('listings');
  const [loading, setLoading] = useState(false);

  const loadOverview = () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setLoading(true);
    apiFetch<AdminOverview>('/api/admin/overview')
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, [currentUser]);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-[#6D2932]" />
        <h2 className="mt-3 font-serif-editorial text-3xl font-semibold text-[#3B281E]">
          Curatorial &amp; Moderation Desk
        </h2>
        <p className="mt-2 text-sm text-[#6E5B4F]">
          Administrator privileges are required to access platform moderation, badge verification, and dispute logs.
        </p>
      </section>
    );
  }

  const handleToggleFeatured = async (product: Product) => {
    try {
      await apiFetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ featured: !product.featured }),
      });
      loadOverview();
      onRefreshProducts();
      onNotifyToast(product.featured ? 'Removed from spotlight.' : 'Promoted to editorial spotlight.');
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleModerateListing = async (product: Product, status: 'active' | 'flagged') => {
    try {
      await apiFetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadOverview();
      onRefreshProducts();
      onNotifyToast(`Listing status set to ${status}.`);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Moderation failed');
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await apiFetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNotes: `Reviewed by ${currentUser.name}` }),
      });
      loadOverview();
      onNotifyToast(`Report marked ${status}.`);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Could not update report');
    }
  };

  const handleToggleBadge = async (user: User, badge: string) => {
    const nextBadges = user.badges.includes(badge)
      ? user.badges.filter((b) => b !== badge)
      : [...user.badges, badge];
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ badges: nextBadges }),
      });
      loadOverview();
      onRefreshProducts();
      onNotifyToast(`Updated badges for ${user.name}.`);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to update badge');
    }
  };

  const handleRoleChange = async (user: User, role: UserRole) => {
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      loadOverview();
      onNotifyToast(`Updated role for ${user.name} to ${role}.`);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  const handleSuspendToggle = async (user: User) => {
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_suspended: !user.is_suspended }),
      });
      loadOverview();
      onRefreshProducts();
      onNotifyToast(user.is_suspended ? `${user.name} restored.` : `${user.name} suspended.`);
    } catch (err) {
      onNotifyToast(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-[#D8CEBA] pb-5">
        <p className="text-xs font-medium uppercase tracking-widest text-[#B08D57]">
          Platform Governance
        </p>
        <h1 className="mt-1 font-serif-editorial text-4xl font-semibold text-[#3B281E]">
          Admin Moderation Console
        </h1>
      </div>

      {loading && !data ? (
        <div className="py-12 text-sm text-[#6E5B4F]">Loading moderation telemetry...</div>
      ) : data ? (
        <>
          {/* KPI Strip */}
          <div className="mt-6 grid grid-cols-2 gap-4 border border-[#D8CEBA] bg-white p-6 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Platform GMV</span>
              <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
                ${data.stats.gmv.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Active Pieces</span>
              <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
                {data.stats.activeListings}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Flagged</span>
              <p className="mt-1 text-2xl font-semibold text-[#6D2932] tabular-nums">
                {data.stats.flaggedListings}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Open Reports</span>
              <p className="mt-1 text-2xl font-semibold text-[#6D2932] tabular-nums">
                {data.stats.openReports}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Barters Closed</span>
              <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
                {data.stats.completedBarters}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-[#6E5B4F]">Members</span>
              <p className="mt-1 text-2xl font-semibold text-[#3B281E] tabular-nums">
                {data.stats.totalUsers}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap gap-2 border-b border-[#D8CEBA] pb-4">
            <button
              type="button"
              onClick={() => setTab('listings')}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider cursor-pointer ${
                tab === 'listings'
                  ? 'bg-[#3B281E] text-[#F9F6F0]'
                  : 'border border-[#D8CEBA] bg-white text-[#3B281E]'
              }`}
            >
              Listings Moderation ({data.products.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('reports')}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider cursor-pointer ${
                tab === 'reports'
                  ? 'bg-[#3B281E] text-[#F9F6F0]'
                  : 'border border-[#D8CEBA] bg-white text-[#3B281E]'
              }`}
            >
              Reports Queue ({data.reports.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('members')}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider cursor-pointer ${
                tab === 'members'
                  ? 'bg-[#3B281E] text-[#F9F6F0]'
                  : 'border border-[#D8CEBA] bg-white text-[#3B281E]'
              }`}
            >
              Members &amp; Badges ({data.users.length})
            </button>
          </div>

          {tab === 'listings' && (
            <div className="mt-6 overflow-x-auto border border-[#D8CEBA] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#D8CEBA] bg-[#EFE9DD]/60 text-xs uppercase tracking-wider text-[#6E5B4F]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Piece</th>
                    <th className="px-4 py-3 font-medium">Storefront</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CEBA]">
                  {data.products.map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-14 shrink-0 overflow-hidden border border-[#D8CEBA]">
                            <SafeImage src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#3B281E]">{p.title}</p>
                            <p className="text-xs text-[#6E5B4F]">{p.brand} · Stock {p.stock}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-[#3B281E]">{p.seller_store_name}</td>
                      <td className="px-4 py-4 font-semibold text-[#3B281E] tabular-nums">
                        ${p.price.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">
                        <span className={p.status === 'flagged' ? 'text-[#6D2932]' : 'text-[#3B281E]'}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleFeatured(p)}
                            className={`inline-flex items-center gap-1 border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                              p.featured
                                ? 'border-[#B08D57] bg-[#EFE9DD] text-[#3B281E]'
                                : 'border-[#D8CEBA] bg-white text-[#6E5B4F]'
                            }`}
                          >
                            <Star className={`h-3 w-3 ${p.featured ? 'fill-[#B08D57] text-[#B08D57]' : ''}`} />
                            {p.featured ? 'Spotlighted' : 'Spotlight'}
                          </button>
                          {p.status === 'flagged' ? (
                            <button
                              type="button"
                              onClick={() => handleModerateListing(p, 'active')}
                              className="inline-flex items-center gap-1 bg-[#3B281E] px-3 py-1.5 text-xs font-medium text-[#F9F6F0] cursor-pointer"
                            >
                              <Check className="h-3 w-3" />
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleModerateListing(p, 'flagged')}
                              className="inline-flex items-center gap-1 border border-[#6D2932] px-3 py-1.5 text-xs font-medium text-[#6D2932] hover:bg-[#6D2932] hover:text-[#F9F6F0] cursor-pointer"
                            >
                              <Flag className="h-3 w-3" />
                              Flag
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'reports' && (
            <div className="mt-6 space-y-4">
              {data.reports.length === 0 ? (
                <div className="border border-[#D8CEBA] bg-white p-8 text-center text-sm text-[#6E5B4F]">
                  No reports submitted. All marketplace listings are clear.
                </div>
              ) : (
                data.reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="flex flex-col justify-between gap-4 border border-[#D8CEBA] bg-white p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#6E5B4F]">
                        <span className="font-semibold uppercase text-[#6D2932]">{rep.status}</span>
                        <span aria-hidden="true">·</span>
                        <span>Reported by {rep.reporter_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>Target: {rep.target_label}</span>
                      </div>
                      <p className="mt-1 text-sm text-[#3B281E]">{rep.reason}</p>
                    </div>
                    {rep.status === 'open' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveReport(rep.id, 'resolved')}
                          className="bg-[#6D2932] px-4 py-2 text-xs font-medium text-[#F9F6F0] cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolveReport(rep.id, 'dismissed')}
                          className="border border-[#D8CEBA] bg-[#EFE9DD] px-4 py-2 text-xs font-medium text-[#3B281E] cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'members' && (
            <div className="mt-6 space-y-4">
              {data.users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col justify-between gap-4 border border-[#D8CEBA] bg-white p-5 lg:flex-row lg:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-[#3B281E]">{u.name}</span>
                      <span className="text-xs text-[#6E5B4F]">({u.email})</span>
                      {u.is_suspended && (
                        <span className="text-xs font-semibold uppercase text-[#6D2932]">
                          · Suspended
                        </span>
                      )}
                    </div>
                    {u.store_name && (
                      <p className="mt-0.5 text-xs text-[#6E5B4F]">
                        Storefront: {u.store_name} · {u.store_location}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#6E5B4F]">Seller Badges:</span>
                      {AVAILABLE_BADGES.map((badge) => {
                        const active = u.badges.includes(badge);
                        return (
                          <button
                            key={badge}
                            type="button"
                            onClick={() => handleToggleBadge(u, badge)}
                            className={`inline-flex items-center gap-1 border px-2.5 py-1 text-xs cursor-pointer ${
                              active
                                ? 'border-[#B08D57] bg-[#EFE9DD] font-medium text-[#3B281E]'
                                : 'border-[#D8CEBA] bg-white text-[#6E5B4F]'
                            }`}
                          >
                            <Award className={`h-3 w-3 ${active ? 'text-[#B08D57]' : 'text-[#D8CEBA]'}`} />
                            {badge}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                      className="border border-[#D8CEBA] bg-[#F9F6F0] px-3 py-2 text-xs font-medium text-[#3B281E]"
                    >
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="admin">Admin</option>
                    </select>

                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => handleSuspendToggle(u)}
                        className={`border px-3.5 py-2 text-xs font-medium cursor-pointer ${
                          u.is_suspended
                            ? 'border-[#3B281E] bg-[#3B281E] text-[#F9F6F0]'
                            : 'border-[#6D2932] text-[#6D2932] hover:bg-[#6D2932] hover:text-[#F9F6F0]'
                        }`}
                      >
                        {u.is_suspended ? 'Restore Account' : 'Suspend'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
};
