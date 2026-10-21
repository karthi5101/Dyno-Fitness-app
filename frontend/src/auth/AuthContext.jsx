import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getCurrentIdentity,
  isAuthenticated,
  login as loginRequest,
  logout as logoutRequest,
} from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
   * ---------------------------------------------------------
   * RESTORE SESSION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      if (!isAuthenticated()) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }

        return;
      }

      try {
        const identity =
          await getCurrentIdentity();

        if (!mounted) {
          return;
        }

        /*
         * Backend identity is authoritative.
         * Never mix in stale localStorage values.
         */

        const normalizedIdentity = {
          username: identity?.username ?? null,
          member_id: identity?.member_id ?? null,
          role: identity?.role ?? null,
        };

        setUser(normalizedIdentity);
      } catch (error) {
        console.error(
          "Unable to restore authentication session:",
          error,
        );

        logoutRequest();

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * LOGIN
   * ---------------------------------------------------------
   */

  async function login(username, password) {
    const data =
      await loginRequest(
        username,
        password,
      );

    /*
     * Build the same identity shape used everywhere else.
     *
     * IMPORTANT:
     * role must NOT be dropped here.
     */

    const identity = {
      username:
        data?.user?.username ||
        username ||
        null,

      member_id:
        data?.user?.member_id || null,

      role:
        data?.user?.role ||
        data?.role ||
        null,
    };

    setUser(identity);

    return data;
  }

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */

  function logout() {
    logoutRequest();
    setUser(null);
  }

  /*
   * ---------------------------------------------------------
   * AUTH CONTEXT
   * ---------------------------------------------------------
   */

  const value = {
    user,

    loading,

    isAuthenticated:
      Boolean(user),

    username: user?.username || null,

    memberId: user?.member_id || null,

    role: user?.role || null,

    login,

    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider.",
    );
  }

  return context;
}