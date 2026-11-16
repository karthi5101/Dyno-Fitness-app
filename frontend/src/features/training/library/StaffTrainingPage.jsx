import { useState } from "react";

import ExerciseLibrary from "./ExerciseLibrary";
import ProgramsPage from "../programs/ProgramsPage";


function StaffTrainingPage() {
  const [tab, setTab] = useState("library");

  return (
    <main className="trn-shell">
      <header className="trn-shell-header">
        <p className="trn-eyebrow">TRAINING</p>
        <h1>WORKOUTS</h1>
        <p className="trn-shell-copy">
          Build the movement library, prepare
          programs, and keep every member&apos;s
          training grounded in clear coaching
          detail.
        </p>
      </header>

      <nav
        className="trn-tabs"
        aria-label="Training sections"
      >
        <button
          type="button"
          className={
            tab === "library"
              ? "trn-tab trn-tab-active"
              : "trn-tab"
          }
          onClick={() => setTab("library")}
        >
          LIBRARY
        </button>
        <button
          type="button"
          className={
            tab === "programs"
              ? "trn-tab trn-tab-active"
              : "trn-tab"
          }
          onClick={() => setTab("programs")}
        >
          PROGRAMS
        </button>
      </nav>

      {tab === "library" ? (
        <ExerciseLibrary />
      ) : (
        <ProgramsPage onClose={() => setTab("library")} />
      )}
    </main>
  );
}


export default StaffTrainingPage;
