import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "./AuthContext";

export default function ProtectedRoute({
  children,
  requiredRole = null,
  allowedRoles = null,
}) {
  const location = useLocation();

  const {
    loading,
    isAuthenticated,
    role,
  } = useAuth();

  /*
   * ---------------------------------------------------------
   * AUTH LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return null;
  }

  /*
   * ---------------------------------------------------------
   * NOT AUTHENTICATED
   * ---------------------------------------------------------
   */

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  /*
   * ---------------------------------------------------------
   * ROLE CHECK
   * ---------------------------------------------------------
   *
   * requiredRole:
   *     Exactly one role.
   *
   * allowedRoles:
   *     Multiple roles can access the route.
   *
   * allowedRoles is useful for shared operational pages
   * such as the QR scanner.
   */

  const roles = Array.isArray(allowedRoles)
    ? allowedRoles
    : requiredRole
      ? [requiredRole]
      : null;

  if (
    roles &&
    roles.length > 0 &&
    !roles.includes(role)
  ) {
    /*
     * Never redirect blindly based on the requested URL.
     *
     * Always redirect according to the authenticated
     * account's actual role.
     */

    if (role === "staff") {
      return (
        <Navigate
          to="/staff/dashboard"
          replace
        />
      );
    }

    if (role === "member") {
      return (
        <Navigate
          to="/member/dashboard"
          replace
        />
      );
    }

    /*
     * Unknown role:
     * force a clean login.
     */

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}