import { NavLink, Route, Routes } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import DietPage from "./pages/DietPage";
import AttendancePage from "./pages/AttendancePage";
import "./App.css";

const primaryNavigation = [
  { label: "Overview", path: "/" },
  { label: "Workout", path: "/workouts" },
  { label: "Diet", path: "/diet" },
  { label: "Attendance", path: "/attendance" },
  { label: "Progress", path: "/transformations" },
  { label: "Membership", path: "/membership" },
];

const secondaryNavigation = [
  { label: "Sessions", path: "/sessions" },
  { label: "Members", path: "/members" },
  { label: "Inactive", path: "/inactive-members" },
];

function ComingSoonPage({ title }) {
  return (
    <section className="dyno-placeholder">
      <p className="dyno-placeholder-eyebrow">DYNO FITNESS</p>
      <h1 className="dyno-placeholder-title">{title}</h1>
      <p className="dyno-placeholder-description">
        This part of the Dyno Fitness experience is connected to
        the application structure and will be built in its
        dedicated phase.
      </p>
    </section>
  );
}

function NavigationLink({ item }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        `dyno-nav-link ${isActive ? "dyno-nav-link-active" : ""}`
      }
    >
      <span>{item.label}</span>
    </NavLink>
  );
}

function App() {
  return (
    <div className="dyno-app">
      <header className="dyno-topbar">
        <div className="dyno-brand">
          <span className="dyno-brand-mark">D</span>
          <div className="dyno-brand-copy">
            <span className="dyno-brand-name">DYNO</span>
            <span className="dyno-brand-subtitle">FITNESS</span>
          </div>
        </div>

        <div className="dyno-topbar-center">
          <span className="dyno-topbar-status">
            TRAIN. MOVE. BECOME.
          </span>
        </div>

        <button
          type="button"
          className="dyno-profile-button"
          aria-label="Open account settings"
        >
          <span>DF</span>
        </button>
      </header>

      <div className="dyno-shell">
        <aside className="dyno-sidebar">
          <div className="dyno-sidebar-intro">
            <span className="dyno-sidebar-eyebrow">MEMBER</span>
            <span className="dyno-sidebar-title">
              YOUR
              <br />
              JOURNEY
            </span>
          </div>

          <nav
            className="dyno-navigation"
            aria-label="Member navigation"
          >
            <div className="dyno-navigation-group">
              <span className="dyno-navigation-heading">
                EXPERIENCE
              </span>

              <div className="dyno-navigation-links">
                {primaryNavigation.map((item) => (
                  <NavigationLink
                    key={item.path}
                    item={item}
                  />
                ))}
              </div>
            </div>

            <div className="dyno-navigation-group dyno-navigation-group-secondary">
              <span className="dyno-navigation-heading">
                GYM
              </span>

              <div className="dyno-navigation-links">
                {secondaryNavigation.map((item) => (
                  <NavigationLink
                    key={item.path}
                    item={item}
                  />
                ))}
              </div>
            </div>
          </nav>

          <div className="dyno-sidebar-footer">
            <span className="dyno-sidebar-footer-label">
              DYNO FITNESS
            </span>

            <span className="dyno-sidebar-footer-copy">
              TRAIN WITH PURPOSE.
            </span>
          </div>
        </aside>

        <main className="dyno-main">
          <div className="dyno-mobile-navigation">
            <nav
              className="dyno-mobile-navigation-scroll"
              aria-label="Mobile member navigation"
            >
              {primaryNavigation.map((item) => (
                <NavigationLink
                  key={item.path}
                  item={item}
                />
              ))}
            </nav>
          </div>

          <div className="dyno-page">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/diet" element={<DietPage />} />

              <Route
                path="/members"
                element={<ComingSoonPage title="Members" />}
              />

              <Route
                path="/sessions"
                element={<ComingSoonPage title="Sessions" />}
              />

              <Route
                path="/workouts"
                element={<ComingSoonPage title="Workout" />}
              />

              <Route
                path="/transformations"
                element={<ComingSoonPage title="Progress" />}
              />

              <Route
                path="/membership"
                element={<ComingSoonPage title="Membership" />}
              />

              <Route
                path="/inactive-members"
                element={
                  <ComingSoonPage title="Inactive Members" />
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
