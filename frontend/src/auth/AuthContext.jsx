import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  getCurrentIdentity,
  getStoredMemberId,
  getStoredRole,
  getStoredUsername,
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
         * Always keep role inside React state.
         *
         * Backend identity is authoritative.
         * Stored localStorage role is only a fallback.
         */

        const normalizedIdentity = {
          username:
            identity?.username ||
            getStoredUsername() ||
            null,

          member_id:
            identity?.member_id ||
            getStoredMemberId() ||
            null,

          role:
            identity?.role ||
            getStoredRole() ||
            null,
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
        data?.user?.member_id ||
        getStoredMemberId() ||
        null,

      role:
        data?.user?.role ||
        data?.role ||
        getStoredRole() ||
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

    username:
      user?.username ||
      getStoredUsername() ||
      null,

    memberId:
      user?.member_id ||
      getStoredMemberId() ||
      null,

    role:
      user?.role ||
      getStoredRole() ||
      null,

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