const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    },
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      data?.detail ||
      data?.message ||
      "An API request failed.";

    throw new Error(errorMessage);
  }

  return data;
}

export async function getHealth() {
  return apiRequest("/health/");
}

export async function getMembers() {
  const data = await apiRequest("/members/");
  return data?.value ?? data;
}

export async function getMember(memberId) {
  return apiRequest(`/members/${memberId}/`);
}

export async function createMember(memberData) {
  return apiRequest("/members/", {
    method: "POST",
    body: JSON.stringify(memberData),
  });
}

export async function updateMember(memberId, memberData) {
  return apiRequest(`/members/${memberId}/`, {
    method: "PUT",
    body: JSON.stringify(memberData),
  });
}

export async function deactivateMember(memberId) {
  return apiRequest(`/members/${memberId}/`, {
    method: "DELETE",
  });
}

export async function getAttendance() {
  return apiRequest("/attendance/");
}

export async function getMemberAttendance(memberId) {
  return apiRequest(`/attendance/member/${memberId}/`);
}

export async function getAttendanceRecord(attendanceId) {
  return apiRequest(`/attendance/${attendanceId}/`);
}

export async function createAttendance(attendanceData) {
  return apiRequest("/attendance/", {
    method: "POST",
    body: JSON.stringify(attendanceData),
  });
}

export async function updateAttendance(
  attendanceId,
  attendanceData,
) {
  return apiRequest(`/attendance/${attendanceId}/`, {
    method: "PUT",
    body: JSON.stringify(attendanceData),
  });
}

export async function deleteAttendance(attendanceId) {
  return apiRequest(`/attendance/${attendanceId}/`, {
    method: "DELETE",
  });
}

export async function getDashboard() {
  return apiRequest("/dashboard/");
}

/* ---------------------------------------------------------
   WORKOUTS
--------------------------------------------------------- */

export async function getWorkoutTemplates() {
  return apiRequest("/workouts/templates/");
}

export async function getWorkoutTemplate(templateId) {
  return apiRequest(`/workouts/templates/${templateId}/`);
}

export async function createWorkoutTemplate(templateData) {
  return apiRequest("/workouts/templates/", {
    method: "POST",
    body: JSON.stringify(templateData),
  });
}

export async function updateWorkoutTemplate(
  templateId,
  templateData,
) {
  return apiRequest(`/workouts/templates/${templateId}/`, {
    method: "PUT",
    body: JSON.stringify(templateData),
  });
}

export async function deleteWorkoutTemplate(templateId) {
  return apiRequest(`/workouts/templates/${templateId}/`, {
    method: "DELETE",
  });
}

export async function getWorkoutAssignment(memberId) {
  return apiRequest(`/workouts/assignments/${memberId}/`);
}

export async function assignWorkoutTemplate(
  memberId,
  templateId,
) {
  return apiRequest("/workouts/assignments/", {
    method: "POST",
    body: JSON.stringify({
      member_id: memberId,
      template_id: templateId,
    }),
  });
}

export async function getMemberWorkout(
  memberId,
  workoutDate = null,
) {
  const query = workoutDate
    ? `?date=${encodeURIComponent(workoutDate)}`
    : "";

  const [workoutResult, assignmentResult] =
    await Promise.allSettled([
      apiRequest(`/workouts/daily/${memberId}/${query}`),
      getWorkoutAssignment(memberId),
    ]);

  if (
    workoutResult.status === "rejected" &&
    assignmentResult.status === "rejected"
  ) {
    throw workoutResult.reason;
  }

  return {
    workout:
      workoutResult.status === "fulfilled"
        ? workoutResult.value
        : null,
    assignment:
      assignmentResult.status === "fulfilled"
        ? assignmentResult.value
        : null,
  };
}

export async function createDailyWorkout(workoutData) {
  return apiRequest("/workouts/daily/", {
    method: "POST",
    body: JSON.stringify(workoutData),
  });
}

export async function updateDailyWorkout(
  memberId,
  exercises,
  workoutDate = null,
) {
  const query = workoutDate
    ? `?date=${encodeURIComponent(workoutDate)}`
    : "";

  return apiRequest(`/workouts/daily/${memberId}/${query}`, {
    method: "PUT",
    body: JSON.stringify({
      exercises,
    }),
  });
}

export async function deleteDailyWorkout(
  memberId,
  workoutDate = null,
) {
  const query = workoutDate
    ? `?date=${encodeURIComponent(workoutDate)}`
    : "";

  return apiRequest(`/workouts/daily/${memberId}/${query}`, {
    method: "DELETE",
  });
}

export async function getWorkoutHistory(memberId) {
  return apiRequest(`/workouts/history/${memberId}/`);
}
/* ---------------------------------------------------------
   DIETS
--------------------------------------------------------- */

export async function getDietTemplates() {
  return apiRequest("/diets/templates/");
}

export async function getDietTemplate(templateId) {
  return apiRequest(`/diets/templates/${templateId}/`);
}

export async function createDietTemplate(templateData) {
  return apiRequest("/diets/templates/", {
    method: "POST",
    body: JSON.stringify(templateData),
  });
}

export async function getDietAssignments() {
  return apiRequest("/diets/assignments/");
}

export async function getDietAssignment(assignmentId) {
  return apiRequest(
    `/diets/assignments/${assignmentId}/`,
  );
}

export async function createDietAssignment(
  assignmentData,
) {
  return apiRequest("/diets/assignments/", {
    method: "POST",
    body: JSON.stringify(assignmentData),
  });
}
