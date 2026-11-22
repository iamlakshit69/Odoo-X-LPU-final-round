import React from 'react';
import {
  CalendarDays,
  UserCheck,
  UserPlus,
  ShoppingBag,
  Package,
  Boxes,
  Coffee,
  Utensils,
  LayoutDashboard,
  Contact2,
  Receipt,
  Wallet,
  Users,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface RailItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
}

interface FloatingIconRailProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function FloatingIconRail({ currentPath, onNavigate }: FloatingIconRailProps) {
  const { hasPermission, role } = useAuth();

  const items: RailItem[] = [
    {
      id: 'dashboard',
      label: 'KPI Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      path: '/admin/dashboard',
      permission: 'finance:read',
    },
    {
      id: 'crm',
      label: 'CRM Leads',
      icon: <Contact2 className="w-5 h-5" />,
      path: '/admin/crm',
      permission: 'lead:read',
    },
    {
      id: 'courts',
      label: 'Court Grid',
      icon: <CalendarDays className="w-5 h-5" />,
      path: '/admin/courts',
      permission: 'booking:read',
    },
    {
      id: 'desk',
      label: 'Front Desk',
      icon: <UserCheck className="w-5 h-5" />,
      path: '/admin/desk',
      permission: 'member:read',
    },
    {
      id: 'new-member',
      label: 'New Member',
      icon: <UserPlus className="w-5 h-5" />,
      path: '/admin/members/new',
      permission: 'member:create',
    },
    {
      id: 'shop-pos',
      label: 'Shop POS',
      icon: <ShoppingBag className="w-5 h-5" />,
      path: '/admin/shop/pos',
      permission: 'order:create',
    },
    {
      id: 'shop-orders',
      label: 'Orders Board',
      icon: <Package className="w-5 h-5" />,
      path: '/admin/shop/orders',
      permission: 'order:read',
    },
    {
      id: 'shop-stock',
      label: 'Warehouse Stock',
      icon: <Boxes className="w-5 h-5" />,
      path: '/admin/shop/stock',
      permission: 'stock:read',
    },
    {
      id: 'bar',
      label: 'Lounge Bar',
      icon: <Coffee className="w-5 h-5" />,
      path: '/admin/bar',
      permission: 'tab:read',
    },
    {
      id: 'kds-kitchen',
      label: 'Kitchen KDS',
      icon: <Utensils className="w-5 h-5" />,
      path: '/admin/kds/kitchen',
      permission: 'kds:read',
    },
    {
      id: 'kds-bar',
      label: 'Bar KDS',
      icon: <Coffee className="w-5 h-5 text-accent-orange" />,
      path: '/admin/kds/bar',
      permission: 'kds:read',
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: <Receipt className="w-5 h-5" />,
      path: '/admin/finance/invoices',
      permission: 'invoice:read',
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: <Wallet className="w-5 h-5" />,
      path: '/admin/finance/expenses',
      permission: 'expense:manage',
    },
    {
      id: 'hr',
      label: 'HR & Rota',
      icon: <Users className="w-5 h-5" />,
      path: '/admin/hr',
      permission: 'hr:read',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      path: '/admin/settings',
      permission: 'settings:manage',
    },
  ];

  // Filter items based on permissions
  const visibleItems = items.filter((item) => {
    if (role === 'owner') return true;
    if (!item.permission) return true;
    return hasPermission(item.permission);
  });

  return (
    <aside className="fixed left-3 lg:left-4 top-1/2 -translate-y-1/2 z-30 hidden md:block">
      <div className="flex flex-col items-center gap-1.5 p-1.5 lg:p-2 max-h-[85vh] overflow-y-auto no-scrollbar rounded-full border border-border bg-surface/90 backdrop-blur-md shadow-2xl">
        {visibleItems.map((item) => {
          const isActive = currentPath === item.path || currentPath.startsWith(item.path);

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.path)}
              title={item.label}
              className={`group relative p-2.5 rounded-full transition-all duration-200 ${
                isActive
                  ? 'bg-accent-orange text-white shadow-md shadow-accent-orange/30 scale-105'
                  : 'text-mutedText hover:text-primaryText hover:bg-canvas'
              }`}
            >
              {item.icon}

              {/* Tooltip on hover */}
              <span className="absolute left-full ml-3 px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide whitespace-nowrap bg-primaryText text-canvas shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
