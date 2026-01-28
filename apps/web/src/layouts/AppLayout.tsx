/**
 * Unified App Layout
 *
 * - Role-based navigation (shows/hides items based on user permissions)
 * - Compact mode toggle for floor work (larger buttons, bottom nav)
 * - Full mode for desk work (sidebar, all features)
 */

import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Truck,
  BarChart3,
  PackageCheck,
  PackagePlus,
  ScanLine,
  Bell,
  User,
  ChevronDown,
  Minimize2,
  Maximize2,
  type LucideIcon,
} from "lucide-react";
import { useState, createContext, useContext, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "PICKER"
  | "PACKER"
  | "RECEIVER"
  | "VIEWER";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[]; // If undefined, all roles can see it
  compactOnly?: boolean; // Only show in compact mode
  fullOnly?: boolean; // Only show in full mode
}

interface UserContext {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface LayoutContextType {
  compactMode: boolean;
  setCompactMode: (value: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  user: UserContext | null;
}

// ============================================================================
// Context
// ============================================================================

const LayoutContext = createContext<LayoutContextType | null>(null);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within AppLayout");
  }
  return context;
}

// ============================================================================
// Navigation Configuration
// ============================================================================

const allNavItems: NavItem[] = [
  // Everyone
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "My Tasks", icon: ClipboardList },

  // Work actions (everyone, but prominent in compact mode)
  { to: "/pick", label: "Pick", icon: PackageCheck },
  { to: "/pack", label: "Pack", icon: Package },
  { to: "/receive", label: "Receive", icon: PackagePlus },
  { to: "/scan", label: "Scan", icon: ScanLine },

  // Admin/Manager only
  {
    to: "/orders",
    label: "Orders",
    icon: ShoppingCart,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    to: "/products",
    label: "Products",
    icon: Package,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    to: "/inventory",
    label: "Inventory",
    icon: Warehouse,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    to: "/shipping",
    label: "Shipping",
    icon: Truck,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
    fullOnly: true,
  },

  // Admin only
  {
    to: "/users",
    label: "Users",
    icon: Users,
    roles: ["ADMIN"],
    fullOnly: true,
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["ADMIN"],
    fullOnly: true,
  },
];

// Items for compact mode bottom nav (prioritize work tasks)
const compactNavItems: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/pick", label: "Pick", icon: PackageCheck },
  { to: "/pack", label: "Pack", icon: Package },
  { to: "/scan", label: "Scan", icon: ScanLine },
];

function getNavItemsForRole(role: UserRole, compactMode: boolean): NavItem[] {
  return allNavItems.filter((item) => {
    // Check role permission
    if (item.roles && !item.roles.includes(role)) {
      return false;
    }

    // Check mode
    if (compactMode && item.fullOnly) return false;
    if (!compactMode && item.compactOnly) return false;

    return true;
  });
}

function getCompactNavForRole(role: UserRole): NavItem[] {
  return compactNavItems.filter((item) => {
    if (item.roles && !item.roles.includes(role)) {
      return false;
    }
    return true;
  });
}

// ============================================================================
// AppLayout Component
// ============================================================================

interface AppLayoutProps {
  user?: UserContext | null;
}

export function AppLayout({ user: propUser }: AppLayoutProps) {
  // In real app, get user from auth context
  const [user] = useState<UserContext | null>(
    propUser || {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      role: "ADMIN" as UserRole,
    },
  );

  const [compactMode, setCompactMode] = useState(() => {
    const saved = localStorage.getItem("compactMode");
    return saved === "true";
  });

  const [sidebarOpen, setSidebarOpen] = useState(!compactMode);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Persist compact mode preference
  useEffect(() => {
    localStorage.setItem("compactMode", String(compactMode));
    if (compactMode) {
      setSidebarOpen(false);
    }
  }, [compactMode]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("compactMode");
    navigate("/login");
  };

  const navItems = user ? getNavItemsForRole(user.role, compactMode) : [];
  const bottomNavItems = user ? getCompactNavForRole(user.role) : [];

  const contextValue: LayoutContextType = {
    compactMode,
    setCompactMode,
    sidebarOpen,
    setSidebarOpen,
    user,
  };

  // ============================================================================
  // Compact Mode Layout (Mobile/Floor Work)
  // ============================================================================

  if (compactMode) {
    return (
      <LayoutContext.Provider value={contextValue}>
        <div className="min-h-screen bg-gray-100 flex flex-col">
          {/* Header */}
          <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Warehouse className="w-6 h-6" />
              <span className="font-bold text-lg">WMS</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Mode Toggle */}
              <button
                onClick={() => setCompactMode(false)}
                className="p-2 hover:bg-blue-700 rounded-lg"
                title="Switch to Full Mode"
              >
                <Maximize2 className="w-5 h-5" />
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-2 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                >
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-medium">
                    {user?.name.charAt(0)}
                  </div>
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg py-2 z-50">
                      <div className="px-4 py-2 border-b">
                        <div className="font-medium text-gray-900">
                          {user?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user?.role}
                        </div>
                      </div>
                      <NavLink
                        to="/profile"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Profile
                      </NavLink>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Status Bar */}
          <div className="bg-blue-500 text-white px-4 py-2 text-sm flex items-center justify-between">
            <span>
              {user?.name} • {user?.role}
            </span>
            <span className="flex items-center gap-1">
              <ClipboardList className="w-4 h-4" />
              Active Tasks: 3
            </span>
          </div>

          {/* Main Content - Extra padding for touch */}
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>

          {/* Bottom Navigation - Large Touch Targets */}
          <nav className="bg-white border-t grid grid-cols-5 safe-area-bottom">
            {bottomNavItems.map((item) => {
              const isActive =
                location.pathname === item.to ||
                location.pathname.startsWith(item.to + "/");
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex flex-col items-center py-3 px-2 ${
                    isActive
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-500 active:bg-gray-100"
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-xs mt-1 font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </LayoutContext.Provider>
    );
  }

  // ============================================================================
  // Full Mode Layout (Desktop/Admin Work)
  // ============================================================================

  return (
    <LayoutContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-16"
          } bg-white border-r flex flex-col transition-all duration-200 fixed h-full z-20`}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b">
            {sidebarOpen && (
              <span className="font-bold text-xl text-blue-600">WMS</span>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {/* Group: Work */}
            {sidebarOpen && (
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">
                Work
              </div>
            )}
            {navItems
              .filter((item) =>
                [
                  "/dashboard",
                  "/tasks",
                  "/pick",
                  "/pack",
                  "/receive",
                  "/scan",
                ].includes(item.to),
              )
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-600 font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`
                  }
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              ))}

            {/* Group: Management (Admin/Manager only) */}
            {navItems.some((item) =>
              [
                "/orders",
                "/products",
                "/inventory",
                "/shipping",
                "/reports",
              ].includes(item.to),
            ) && (
              <>
                {sidebarOpen && (
                  <div className="px-4 py-2 mt-4 text-xs font-semibold text-gray-400 uppercase">
                    Management
                  </div>
                )}
                {navItems
                  .filter((item) =>
                    [
                      "/orders",
                      "/products",
                      "/inventory",
                      "/shipping",
                      "/reports",
                    ].includes(item.to),
                  )
                  .map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-600 font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        }`
                      }
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && <span>{item.label}</span>}
                    </NavLink>
                  ))}
              </>
            )}

            {/* Group: Admin (Admin only) */}
            {navItems.some((item) =>
              ["/users", "/settings"].includes(item.to),
            ) && (
              <>
                {sidebarOpen && (
                  <div className="px-4 py-2 mt-4 text-xs font-semibold text-gray-400 uppercase">
                    Admin
                  </div>
                )}
                {navItems
                  .filter((item) => ["/users", "/settings"].includes(item.to))
                  .map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-600 font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        }`
                      }
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && <span>{item.label}</span>}
                    </NavLink>
                  ))}
              </>
            )}
          </nav>

          {/* Compact Mode Toggle */}
          <div className="p-4 border-t">
            <button
              onClick={() => setCompactMode(true)}
              className="flex items-center gap-3 px-4 py-2 w-full text-gray-600 hover:bg-gray-100 rounded-lg"
              title={!sidebarOpen ? "Compact Mode" : undefined}
            >
              <Minimize2 className="w-5 h-5" />
              {sidebarOpen && <span>Compact Mode</span>}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2 w-full text-gray-600 hover:bg-gray-100 rounded-lg mt-1"
              title={!sidebarOpen ? "Logout" : undefined}
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div
          className={`flex-1 flex flex-col ${
            sidebarOpen ? "ml-64" : "ml-16"
          } transition-all duration-200`}
        >
          {/* Top Bar */}
          <header className="h-16 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              {/* Breadcrumb or page title could go here */}
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium text-gray-700">
                      {user?.name}
                    </div>
                    <div className="text-xs text-gray-500">{user?.role}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg py-2 z-50">
                      <div className="px-4 py-2 border-b">
                        <div className="font-medium text-gray-900">
                          {user?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user?.email}
                        </div>
                      </div>
                      <NavLink
                        to="/profile"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Profile
                      </NavLink>
                      <NavLink
                        to="/settings"
                        className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Settings
                      </NavLink>
                      <hr className="my-2" />
                      <button
                        onClick={() => {
                          setCompactMode(true);
                          setUserMenuOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-gray-700 hover:bg-gray-100"
                      >
                        <Minimize2 className="w-4 h-4" />
                        Switch to Compact Mode
                      </button>
                      <hr className="my-2" />
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}

// ============================================================================
// Auth Layout (Login, Register - No navigation)
// ============================================================================

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-xl mb-4">
            <Warehouse className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">WMS</h1>
          <p className="text-gray-500 mt-1">Warehouse Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-8">
          © 2025 WMS. All rights reserved.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Router Example
// ============================================================================

/*
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout, AuthLayout } from "./layouts/AppLayout";

// Pages
import LoginPage from "./pages/auth/login";
import DashboardPage from "./pages/dashboard";
import TasksPage from "./pages/tasks";
import PickPage from "./pages/pick";
import PackPage from "./pages/pack";
import ReceivePage from "./pages/receive";
import ScanPage from "./pages/scan";
import OrdersPage from "./pages/orders";
import ProductsPage from "./pages/products";
import ProductDetailPage from "./pages/products/[id]";
import ProductImportPage from "./pages/products/import";
import InventoryPage from "./pages/inventory";
import UsersPage from "./pages/users";
import SettingsPage from "./pages/settings";

export const router = createBrowserRouter([
  // Redirect root
  { path: "/", element: <Navigate to="/dashboard" replace /> },

  // Auth (no layout)
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
    ],
  },

  // App (role-based, mode-aware)
  {
    element: <AppLayout />,
    children: [
      // Everyone
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/tasks", element: <TasksPage /> },
      { path: "/tasks/:id", element: <TaskDetailPage /> },
      { path: "/pick", element: <PickPage /> },
      { path: "/pick/:taskId", element: <PickTaskPage /> },
      { path: "/pack", element: <PackPage /> },
      { path: "/pack/:taskId", element: <PackTaskPage /> },
      { path: "/receive", element: <ReceivePage /> },
      { path: "/scan", element: <ScanPage /> },
      { path: "/profile", element: <ProfilePage /> },

      // Admin/Manager only (protected in component or route guard)
      { path: "/orders", element: <OrdersPage /> },
      { path: "/orders/:id", element: <OrderDetailPage /> },
      { path: "/products", element: <ProductsPage /> },
      { path: "/products/import", element: <ProductImportPage /> },
      { path: "/products/:id", element: <ProductDetailPage /> },
      { path: "/inventory", element: <InventoryPage /> },
      { path: "/shipping", element: <ShippingPage /> },
      { path: "/reports", element: <ReportsPage /> },

      // Admin only
      { path: "/users", element: <UsersPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
*/
