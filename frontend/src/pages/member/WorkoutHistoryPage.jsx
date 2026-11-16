import SessionsPage from "../../features/training/member/SessionsPage";
import "../../features/training/library/ExerciseLibrary.css";

function WorkoutHistoryPage() {
  return (
    <main className="trn-shell trn-member-shell">
      <header className="trn-shell-header">
        <p className="trn-eyebrow">MEMBER TRAINING</p>
        <h1>WORKOUT HISTORY</h1>
        <p className="trn-shell-copy">
          Review your completed training sessions and logged performance.
        </p>
      </header>
      <SessionsPage />
    </main>
  );
}

export default WorkoutHistoryPage;
