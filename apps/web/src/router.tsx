import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { AppLayout, AuthLayout } from "./layouts";

// Auth Pages
import { LoginPage } from "./pages/auth/Login";
// import RegisterPage from "./pages/auth/register";
// import ForgotPasswordPage from "./pages/auth/forgot-password";

// Dashboard
import { DashboardPage } from "./pages/dashboard";

// Tasks
import { TasksPage } from "./pages/tasks";
// import TaskDetailPage from "./pages/tasks/[id]";

// Work Functions
import { PickPage } from "./pages/pick";
// import PickTaskPage from "./pages/pick/[taskId]";
import { PackPage } from "./pages/pack";
// import PackTaskPage from "./pages/pack/[taskId]";
import { ReceivePage } from "./pages/receive";
import { ScanPage } from "./pages/scan";

// Orders
import { OrdersPage } from "./pages/orders";
// import OrderDetailPage from "./pages/orders/[id]";

// Products
import ProductsPage from "./pages/products";
import ProductDetailPage from "./pages/products/[id]";
import ProductImportPage from "./pages/products/import";

// Inventory
import { InventoryPage } from "./pages/inventory";

// Shipping
import { ShippingPage } from "./pages/shipping";

// Reports
import { ReportsPage } from "./pages/reports";

// Users
import { UsersPage } from "./pages/users";
// import UserDetailPage from "./pages/users/[id]";

// Settings
import { SettingsPage } from "./pages/settings";

// Profile
// import ProfilePage from "./pages/profile";

// Add this wrapper component
function AuthProviderLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    // Wrap ALL routes with AuthProvider
    element: <AuthProviderLayout />,
    children: [
      // Redirect root to dashboard
      {
        path: "/",
        element: <Navigate to="/dashboard" replace />,
      },

      // Auth Routes (no sidebar)
      {
        element: <AuthLayout />,
        children: [{ path: "/login", element: <LoginPage /> }],
      },

      // App Routes (with layout, role-based nav)
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/tasks", element: <TasksPage /> },
          { path: "/pick", element: <PickPage /> },
          { path: "/pack", element: <PackPage /> },
          { path: "/receive", element: <ReceivePage /> },
          { path: "/scan", element: <ScanPage /> },
          { path: "/orders", element: <OrdersPage /> },
          { path: "/products", element: <ProductsPage /> },
          { path: "/products/import", element: <ProductImportPage /> },
          { path: "/products/:id", element: <ProductDetailPage /> },
          { path: "/shipping", element: <ShippingPage /> },
          { path: "/inventory", element: <InventoryPage /> },
          { path: "/reports", element: <ReportsPage /> },
          { path: "/users", element: <UsersPage /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
