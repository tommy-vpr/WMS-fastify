import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { AppLayout, AuthLayout } from "./layouts";

// Auth Pages
import { LoginPage } from "./pages/auth/Login";
import { SignupPage } from "./pages/auth/Signup";

// import ForgotPasswordPage from "./pages/auth/forgot-password";

// Dashboard
import { DashboardPage } from "./pages/dashboard";

// Fulfillment
import FulfillmentListPage from "./pages/fulfillment";
import FulfillmentDetailPage from "./pages/fulfillment/[id]";

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
import { OrderDetailPage } from "./pages/orders/[id]";

// Products
import ProductsPage from "./pages/products";
import ProductDetailPage from "./pages/products/[id]";
import ProductImportPage from "./pages/products/import";

// Inventory
import { InventoryPage } from "./pages/inventory";
import { InventoryDetailPage } from "./pages/inventory/[id]";

// Shipping
import { ShippingPage } from "./pages/shipping";

// Reports
import { ReportsPage } from "./pages/reports";

// Users
import { UsersPage } from "./pages/users";
// import UserDetailPage from "./pages/users/[id]";

// Settings
import { SettingsPage } from "./pages/settings";
import LocationsPage from "./pages/locations";
import LocationDetailPage from "./pages/locations/[id]";

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
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/signup", element: <SignupPage /> },
        ],
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
          // Orders
          { path: "/orders", element: <OrdersPage /> },
          { path: "/orders/:id", element: <OrderDetailPage /> },
          // Fulfilment
          { path: "/fulfillment", element: <FulfillmentListPage /> },
          { path: "/fulfillment/:orderId", element: <FulfillmentDetailPage /> },
          // Products
          { path: "/products", element: <ProductsPage /> },
          { path: "/products/import", element: <ProductImportPage /> },
          { path: "/products/:id", element: <ProductDetailPage /> },
          { path: "/shipping", element: <ShippingPage /> },
          // Locations
          { path: "/locations", element: <LocationsPage /> },
          { path: "/locations/:id", element: <LocationDetailPage /> },

          { path: "/shipping", element: <ShippingPage /> },
          // Inventory
          { path: "/inventory", element: <InventoryPage /> },
          { path: "/inventory/:id", element: <InventoryDetailPage /> },

          { path: "/reports", element: <ReportsPage /> },
          { path: "/users", element: <UsersPage /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
