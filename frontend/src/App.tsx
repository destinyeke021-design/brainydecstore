import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { RequireRole } from "./components/ui";
import { Login, Register, ResetPassword } from "./pages/Auth";
import { Account, OrderDetail, Orders, SupportPage, WalletPage, WishlistPage } from "./pages/Account";
import { CartPage, Checkout, PaymentCallback } from "./pages/Shopping";
import Admin from "./pages/Admin";
import { DeliveryDashboard, SupportDesk } from "./pages/Staff";
import Home from "./pages/Home";
import { ProductDetail, Products } from "./pages/Catalog";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:slug" element={<ProductDetail />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="checkout" element={<RequireRole roles={["customer"]}><Checkout /></RequireRole>} />
        <Route path="payment/callback" element={<RequireRole roles={["customer"]}><PaymentCallback /></RequireRole>} />
        <Route path="account" element={<RequireRole roles={["customer"]}><Account /></RequireRole>} />
        <Route path="orders" element={<RequireRole roles={["customer"]}><Orders /></RequireRole>} />
        <Route path="orders/:number" element={<RequireRole roles={["customer"]}><OrderDetail /></RequireRole>} />
        <Route path="wallet" element={<RequireRole roles={["customer"]}><WalletPage /></RequireRole>} />
        <Route path="wishlist" element={<RequireRole roles={["customer"]}><WishlistPage /></RequireRole>} />
        <Route path="support" element={<RequireRole roles={["customer"]}><SupportPage /></RequireRole>} />
        <Route path="admin" element={<RequireRole roles={["super_admin", "store_admin"]}><Admin /></RequireRole>} />
        <Route path="delivery" element={<RequireRole roles={["delivery_agent"]}><DeliveryDashboard /></RequireRole>} />
        <Route path="support-desk" element={<RequireRole roles={["support_agent"]}><SupportDesk /></RequireRole>} />
        <Route path="*" element={<div className="p-10 text-center">Page not found.</div>} />
      </Route>
    </Routes>
  );
}
