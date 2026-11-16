import {
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import ExerciseLibrary from "../../features/training/library/ExerciseLibrary";
import TodayPage from "../../features/training/member/TodayPage";
import SessionPage from "../../features/training/member/SessionPage";
import SessionsPage from "../../features/training/member/SessionsPage";
import "../../features/training/library/ExerciseLibrary.css";

function WorkoutPage() {
  return (
    <main className="trn-shell trn-member-shell">
      <header className="trn-shell-header">
        <p className="trn-eyebrow">MEMBER TRAINING</p>
        <h1>WORKOUT</h1>
        <p className="trn-shell-copy">
          Open today&apos;s session, log sets even without a connection, and browse the movement library.
        </p>
      </header>

      <nav className="trn-tabs" aria-label="Member training sections">
        <NavLink
          to="/member/workout/today"
          className={({ isActive }) =>
            `trn-tab${isActive ? " trn-tab-active" : ""}`
          }
        >
          TODAY
        </NavLink>

        <NavLink
          to="/member/workout/history"
          className={({ isActive }) =>
            `trn-tab${isActive ? " trn-tab-active" : ""}`
          }
        >
          HISTORY
        </NavLink>

        <NavLink
          to="/member/workout/exercises"
          className={({ isActive }) =>
            `trn-tab${isActive ? " trn-tab-active" : ""}`
          }
        >
          EXERCISES
        </NavLink>
      </nav>

      <Routes>
        <Route path="today" element={<TodayPage />} />
        <Route path="session/:sessionId" element={<SessionPage />} />
        <Route path="session/:assignmentId/:sessionId" element={<SessionPage />} />
        <Route path="history" element={<SessionsPage />} />
        <Route path="history/:assignmentId" element={<SessionsPage />} />
        <Route
          path="exercises"
          element={
            <ExerciseLibrary
              readOnly
              title="EXERCISES"
              eyebrow="LIBRARY"
            />
          }
        />
        <Route
          path="*"
          element={
            <Navigate
              to="/member/workout/today"
              replace
            />
          }
        />
      </Routes>
    </main>
  );
}

export default WorkoutPage;
