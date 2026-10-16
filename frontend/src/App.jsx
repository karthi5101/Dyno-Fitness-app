import {
  Navigate,
  Link,
  Route,
  Routes,
} from "react-router-dom";

import {
  AuthProvider,
} from "./auth/AuthContext";

import ProtectedRoute from "./auth/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";

/* =========================================================
   MEMBER PAGES
========================================================= */

import MemberDashboardPage from "./pages/member/DashboardPage";
import MemberWorkoutPage from "./pages/member/WorkoutPage";
import MemberWorkoutHistoryPage from "./pages/member/WorkoutHistoryPage";
import MemberDietPage from "./pages/member/DietPage";
import MemberAttendancePage from "./pages/member/AttendancePage";
import MemberProgressPage from "./pages/member/ProgressPage";
import MemberMembershipPage from "./pages/member/MembershipPage";
import MemberProfilePage from "./pages/member/ProfilePage";
import MemberAttendanceScanPage from "./pages/member/AttendanceScanPage";

/* =========================================================
   STAFF PAGES
========================================================= */

import StaffDashboardPage from "./pages/staff/DashboardPage";
import MembersPage from "./pages/staff/MembersPage";
import MemberProfileStaffPage from "./pages/staff/MemberProfilePage";
import StaffAttendancePage from "./pages/staff/AttendancePage";
import StaffSessionsPage from "./pages/staff/SessionsPage";
import StaffWorkoutsPage from "./pages/staff/WorkoutsPage";
import StaffDietsPage from "./pages/staff/DietsPage";
import StaffProgressPage from "./pages/staff/ProgressPage";
import StaffMembershipPage from "./pages/staff/MembershipPage";
import StaffPaymentsPage from "./pages/staff/PaymentsPage";
import InactiveMembersPage from "./pages/staff/InactiveMembersPage";
import StaffGymQRPage from "./pages/staff/GymQRPage";

/* =========================================================
   PROTECTED ROUTE
========================================================= */

function Protected({
  children,
  role,
  roles,
}) {
  return (
    <ProtectedRoute
      requiredRole={role}
      allowedRoles={roles}
    >
      {children}
    </ProtectedRoute>
  );
}

/* =========================================================
   COMMON STAFF BACK BUTTON
========================================================= */

function StaffBackButton({
  to,
  label,
}) {
  return (
    <>
      <Link
        to={to}
        className="staff-common-back"
      >
        <span>←</span>
        {label}
      </Link>

      <style>
        {`
          .staff-common-back {
            position: fixed;
            top: 22px;
            left: 24px;
            z-index: 9999;

            display: inline-flex;
            align-items: center;
            gap: 8px;

            min-height: 34px;
            padding: 0 14px;

            border: 1px solid #dededb;
            border-radius: 999px;

            background: rgba(245, 245, 243, 0.96);
            color: #111111;

            font-family:
              "Inter",
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              sans-serif;

            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-decoration: none;

            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);

            transition:
              background 180ms ease,
              color 180ms ease,
              border-color 180ms ease,
              transform 180ms ease;
          }

          .staff-common-back span {
            font-size: 15px;
            line-height: 1;
          }

          .staff-common-back:hover {
            border-color: #c2182b;
            background: #c2182b;
            color: #ffffff;
            transform: translateX(-2px);
          }

          .staff-common-back.staff-common-back-attendance
            ~ .staff-page
            .staff-page-back {
            display: none !important;
          }

          @media (max-width: 768px) {
            .staff-common-back {
              top: 14px;
              left: 14px;
              min-height: 32px;
              padding: 0 11px;
            }
          }
        `}
      </style>
    </>
  );
}

/* =========================================================
   STAFF ROUTE WRAPPER
========================================================= */

function StaffRoute({
  children,
  backTo,
  backLabel,
}) {
  return (
    <Protected role="staff">
      <StaffBackButton
        to={backTo}
        label={backLabel}
      />

      {children}
    </Protected>
  );
}

/* =========================================================
   ROUTES
========================================================= */

function AppRoutes() {
  return (
    <Routes>

      {/* =====================================================
         AUTH
      ===================================================== */}

      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* =====================================================
         MEMBER SIDE
      ===================================================== */}

      <Route
        path="/member/dashboard"
        element={
          <Protected role="member">
            <MemberDashboardPage />
          </Protected>
        }
      />

      <Route
        path="/member/workout"
        element={
          <Protected role="member">
            <MemberWorkoutPage />
          </Protected>
        }
      />

      {/* =====================================================
         MEMBER → WORKOUT HISTORY
         
         Uses the existing workout history page.
         No backend changes.
         No effect on the current workout route.
      ===================================================== */}

      <Route
        path="/member/workout/history"
        element={
          <Protected role="member">
            <MemberWorkoutHistoryPage />
          </Protected>
        }
      />

      <Route
        path="/member/diet"
        element={
          <Protected role="member">
            <MemberDietPage />
          </Protected>
        }
      />

      <Route
        path="/member/attendance"
        element={
          <Protected role="member">
            <MemberAttendancePage />
          </Protected>
        }
      />

      <Route
        path="/member/attendance/scan"
        element={
          <Protected roles={["member", "staff"]}>
            <MemberAttendanceScanPage />
          </Protected>
        }
      />

      <Route
        path="/member/progress"
        element={
          <Protected role="member">
            <MemberProgressPage />
          </Protected>
        }
      />

      <Route
        path="/member/membership"
        element={
          <Protected role="member">
            <MemberMembershipPage />
          </Protected>
        }
      />

      <Route
        path="/member/profile"
        element={
          <Protected role="member">
            <MemberProfilePage />
          </Protected>
        }
      />

      {/* =====================================================
         STAFF DASHBOARD
         
         Root page intentionally has no back button.
      ===================================================== */}

      <Route
        path="/staff/dashboard"
        element={
          <Protected role="staff">
            <StaffDashboardPage />
          </Protected>
        }
      />

      {/* =====================================================
         STAFF → MEMBERS
      ===================================================== */}

      <Route
        path="/staff/members"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <MembersPage />
          </StaffRoute>
        }
      />

      <Route
        path="/staff/members/:memberId"
        element={
          <StaffRoute
            backTo="/staff/members"
            backLabel="MEMBERS"
          >
            <MemberProfileStaffPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → ATTENDANCE
      ===================================================== */}

      <Route
        path="/staff/attendance"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <StaffAttendancePage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → GYM QR
      ===================================================== */}

      <Route
        path="/staff/gym-qr"
        element={
          <StaffRoute
            backTo="/staff/attendance"
            backLabel="ATTENDANCE"
          >
            <StaffGymQRPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → SESSIONS
      ===================================================== */}

      <Route
        path="/staff/sessions"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <StaffSessionsPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → WORKOUTS
      ===================================================== */}

      <Route
        path="/staff/workouts"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <StaffWorkoutsPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → DIETS
      ===================================================== */}

      <Route
        path="/staff/diets"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <StaffDietsPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → ALL PROGRESS
      ===================================================== */}

      <Route
        path="/staff/progress"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <StaffProgressPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → INDIVIDUAL PROGRESS
      ===================================================== */}

      <Route
        path="/staff/progress/:memberId"
        element={
          <StaffRoute
            backTo="/staff/progress"
            backLabel="ALL PROGRESS"
          >
            <StaffProgressPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → MEMBERSHIP
      ===================================================== */}

      <Route
        path="/staff/membership"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <StaffMembershipPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → PAYMENTS
      ===================================================== */}

      <Route
        path="/staff/payments"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <StaffPaymentsPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         STAFF → INACTIVE MEMBERS
      ===================================================== */}

      <Route
        path="/staff/inactive-members"
        element={
          <StaffRoute
            backTo="/staff/dashboard"
            backLabel="DASHBOARD"
          >
            <InactiveMembersPage />
          </StaffRoute>
        }
      />

      {/* =====================================================
         DEFAULT
      ===================================================== */}

      <Route
        path="/"
        element={
          <Navigate
            to="/member/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/member/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;