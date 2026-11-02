import MemberWorkoutPage from "../../../pages/member/WorkoutPage";
import StaffWorkoutsPage from "../../../pages/staff/WorkoutsPage";

import MemberTrainingPage from "./MemberTrainingPage";
import StaffTrainingPage from "./StaffTrainingPage";


export const trainingEnabled =
  import.meta.env.VITE_WORKOUTS_V2_ENABLED === "true";


export function TrainingMemberEntry() {
  return trainingEnabled ? (
    <MemberTrainingPage />
  ) : (
    <MemberWorkoutPage />
  );
}


export function TrainingStaffEntry() {
  return trainingEnabled ? (
    <StaffTrainingPage />
  ) : (
    <StaffWorkoutsPage />
  );
}
