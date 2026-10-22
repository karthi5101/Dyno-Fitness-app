
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api";

const ACCESS_TOKEN_KEY = "dyno_access_token";
const REFRESH_TOKEN_KEY = "dyno_refresh_token";
const MEMBER_ID_KEY = "dyno_member_id";
const USERNAME_KEY = "dyno_username";
const ROLE_KEY = "dyno_role";

// ---------------------------------------------------------------------------
// AUTH HELPERS
// ---------------------------------------------------------------------------

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAuthHeaders() {
  const token = getAccessToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

// ---------------------------------------------------------------------------
// GENERIC API REQUEST
// ---------------------------------------------------------------------------

function extractErrorMessage(data) {
  if (!data) {
    return "";
  }

  if (typeof data.detail === "string" && data.detail) {
    return data.detail;
  }

  if (typeof data.message === "string" && data.message) {
    return data.message;
  }

  if (Array.isArray(data.non_field_errors)) {
    const joined = data.non_field_errors
      .filter((value) => typeof value === "string")
      .join(" ");

    if (joined) {
      return joined;
    }
  }

  for (const value of Object.values(data)) {
    if (typeof value === "string" && value) {
      return value;
    }

    if (Array.isArray(value)) {
      const first = value.find(
        (item) => typeof item === "string",
      );

      if (first) {
        return first;
      }
    }
  }

  return "";
}

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      extractErrorMessage(data) ||
      "An API request failed.";

    const tokenRejected =
      response.status === 401 &&
      data?.code === "token_not_valid";

    if (tokenRejected) {
      logout();

      throw new Error(
        "Your session has expired. Please sign in again.",
      );
    }

    const error = new Error(message);

    error.status = response.status;

    throw error;
  }

  return data;
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export async function login(username, password) {
  const data = await apiRequest("/auth/login/", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
  });

  logout();

  if (data?.access) {
    localStorage.setItem(
      ACCESS_TOKEN_KEY,
      data.access,
    );
  }

  if (data?.refresh) {
    localStorage.setItem(
      REFRESH_TOKEN_KEY,
      data.refresh,
    );
  }

  if (data?.user?.member_id) {
    localStorage.setItem(
      MEMBER_ID_KEY,
      data.user.member_id,
    );
  }

  if (data?.user?.username) {
    localStorage.setItem(
      USERNAME_KEY,
      data.user.username,
    );
  } else {
    localStorage.setItem(
      USERNAME_KEY,
      username,
    );
  }

  localStorage.setItem(
    ROLE_KEY,
    data?.user?.role ||
      data?.role ||
      "member",
  );

  return data;
}

export function logout() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(MEMBER_ID_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export function getStoredMemberId() {
  return localStorage.getItem(MEMBER_ID_KEY);
}

export function getStoredUsername() {
  return localStorage.getItem(USERNAME_KEY);
}

export function getStoredRole() {
  return localStorage.getItem(ROLE_KEY);
}

export function isStaff() {
  return getStoredRole() === "staff";
}

export function isMember() {
  return getStoredRole() === "member";
}

export async function getCurrentIdentity() {
  const identity = await apiRequest("/auth/me/");

  if (identity?.username) {
    localStorage.setItem(
      USERNAME_KEY,
      identity.username,
    );
  }

  if (identity?.member_id) {
    localStorage.setItem(
      MEMBER_ID_KEY,
      identity.member_id,
    );
  }

  if (identity?.role) {
    localStorage.setItem(
      ROLE_KEY,
      identity.role,
    );
  }

  return identity;
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

export async function getDashboard() {
  return apiRequest("/dashboard/");
}

// ---------------------------------------------------------------------------
// MEMBERS
// ---------------------------------------------------------------------------

export async function getMembers() {
  const data = await apiRequest("/members/");

  return data?.value ?? data;
}

export async function getMember(memberId) {
  return apiRequest(
    `/members/${encodeURIComponent(memberId)}/`,
  );
}

export async function createMember(memberData) {
  return apiRequest("/members/", {
    method: "POST",
    body: JSON.stringify(memberData),
  });
}

export async function updateMember(
  memberId,
  memberData,
) {
  return apiRequest(
    `/members/${encodeURIComponent(memberId)}/`,
    {
      method: "PUT",
      body: JSON.stringify(memberData),
    },
  );
}

export async function deactivateMember(memberId) {
  return apiRequest(
    `/members/${encodeURIComponent(memberId)}/`,
    {
      method: "DELETE",
    },
  );
}

// ---------------------------------------------------------------------------
// ATTENDANCE
// ---------------------------------------------------------------------------

export async function getAttendance() {
  return apiRequest("/attendance/");
}

export async function getTodayAttendance() {
  return apiRequest("/attendance/today/");
}

export async function getGymQRCode() {
  return apiRequest("/attendance/qr/");
}

export async function getMemberAttendance(memberId) {
  return apiRequest(
    `/attendance/member/${encodeURIComponent(memberId)}/`,
  );
}

export async function createAttendance(
  attendanceData,
) {
  return apiRequest("/attendance/", {
    method: "POST",
    body: JSON.stringify(attendanceData),
  });
}

export async function updateAttendance(
  attendanceId,
  attendanceData,
) {
  return apiRequest(
    `/attendance/${encodeURIComponent(attendanceId)}/`,
    {
      method: "PUT",
      body: JSON.stringify(attendanceData),
    },
  );
}

export async function deleteAttendance(attendanceId) {
  return apiRequest(
    `/attendance/${encodeURIComponent(attendanceId)}/`,
    {
      method: "DELETE",
    },
  );
}

// ---------------------------------------------------------------------------
// WORKOUT TEMPLATES
// ---------------------------------------------------------------------------

export async function getWorkoutTemplates() {
  return apiRequest("/workouts/templates/");
}

export async function getWorkoutTemplate(templateId) {
  return apiRequest(
    `/workouts/templates/${encodeURIComponent(templateId)}/`,
  );
}

export async function createWorkoutTemplate(
  templateData,
) {
  return apiRequest("/workouts/templates/", {
    method: "POST",
    body: JSON.stringify(templateData),
  });
}

export async function updateWorkoutTemplate(
  templateId,
  templateData,
) {
  return apiRequest(
    `/workouts/templates/${encodeURIComponent(templateId)}/`,
    {
      method: "PUT",
      body: JSON.stringify(templateData),
    },
  );
}

export async function deleteWorkoutTemplate(
  templateId,
) {
  return apiRequest(
    `/workouts/templates/${encodeURIComponent(templateId)}/`,
    {
      method: "DELETE",
    },
  );
}

// ---------------------------------------------------------------------------
// WORKOUT ASSIGNMENT
// ---------------------------------------------------------------------------

export async function getWorkoutAssignment(memberId) {
  return apiRequest(
    `/workouts/assignments/${encodeURIComponent(memberId)}/`,
  );
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

// ---------------------------------------------------------------------------
// DAILY WORKOUT
// ---------------------------------------------------------------------------

export async function generateDailyWorkout(
  memberId,
  workoutDate = null,
) {
  return apiRequest("/workouts/daily/generate/", {
    method: "POST",
    body: JSON.stringify({
      member_id: memberId,
      ...(workoutDate
        ? {
            workout_date: workoutDate,
          }
        : {}),
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

  const [
    workoutResult,
    assignmentResult,
  ] = await Promise.allSettled([
    apiRequest(
      `/workouts/daily/${encodeURIComponent(memberId)}/${query}`,
    ),
    getWorkoutAssignment(memberId),
  ]);

  const workoutMissing =
    workoutResult.status === "rejected" &&
    workoutResult.reason?.status === 404;

  const assignmentMissing =
    assignmentResult.status === "rejected" &&
    assignmentResult.reason?.status === 404;

  if (workoutMissing && assignmentMissing) {
    return {
      workout: null,
      assignment: null,
    };
  }

  if (
    workoutResult.status === "rejected" &&
    assignmentResult.status === "rejected"
  ) {
    const realFailure = [
      workoutResult.reason,
      assignmentResult.reason,
    ].find(
      (reason) => reason?.status !== 404,
    );

    if (realFailure) {
      throw realFailure;
    }
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

/**
 * Create a daily workout manually.
 *
 * Backend route:
 * POST /workouts/daily/<member_id>/
 *
 * workoutData:
 * {
 *   member_id,
 *   workout_date,
 *   exercises
 * }
 */
export async function createDailyWorkout(
  workoutData,
) {
  if (!workoutData?.member_id) {
    throw new Error(
      "member_id is required to create a daily workout.",
    );
  }

  return apiRequest(
    `/workouts/daily/${encodeURIComponent(
      workoutData.member_id,
    )}/`,
    {
      method: "POST",
      body: JSON.stringify({
        workout_date:
          workoutData.workout_date,
        exercises:
          workoutData.exercises || [],
      }),
    },
  );
}

export async function updateDailyWorkout(
  memberId,
  exercises,
  workoutDate = null,
) {
  const query = workoutDate
    ? `?date=${encodeURIComponent(workoutDate)}`
    : "";

  return apiRequest(
    `/workouts/daily/${encodeURIComponent(memberId)}/${query}`,
    {
      method: "PUT",
      body: JSON.stringify({
        exercises,
      }),
    },
  );
}

export async function deleteDailyWorkout(
  memberId,
  workoutDate = null,
) {
  const query = workoutDate
    ? `?date=${encodeURIComponent(workoutDate)}`
    : "";

  return apiRequest(
    `/workouts/daily/${encodeURIComponent(memberId)}/${query}`,
    {
      method: "DELETE",
    },
  );
}

export async function getWorkoutHistory(memberId) {
  return apiRequest(
    `/workouts/history/${encodeURIComponent(memberId)}/`,
  );
}

// ---------------------------------------------------------------------------
// DIETS
// ---------------------------------------------------------------------------

export async function getDietTemplates() {
  return apiRequest("/diets/templates/");
}

export async function getDietTemplate(templateId) {
  return apiRequest(
    `/diets/templates/${encodeURIComponent(templateId)}/`,
  );
}

export async function createDietTemplate(
  templateData,
) {
  return apiRequest("/diets/templates/", {
    method: "POST",
    body: JSON.stringify(templateData),
  });
}

export async function getDietAssignments() {
  return apiRequest("/diets/assignments/");
}

export async function createDietAssignment(
  assignmentData,
) {
  return apiRequest("/diets/assignments/", {
    method: "POST",
    body: JSON.stringify(assignmentData),
  });
}

export async function assignDietTemplate(
  memberId,
  templateKey,
  assignedDate,
  notes = "",
) {
  return createDietAssignment({
    member_id: memberId,
    template_key: templateKey,
    assigned_date: assignedDate,
    notes,
  });
}

// ---------------------------------------------------------------------------
// GYM SESSIONS
// ---------------------------------------------------------------------------

export async function getSessionOptions() {
  return apiRequest("/sessions/options/");
}

export async function getSessionPreference() {
  return apiRequest("/sessions/preference/");
}

export async function updatePreferredSession(
  sessionKey,
) {
  return apiRequest("/sessions/preference/", {
    method: "PUT",
    body: JSON.stringify({
      session_key: sessionKey,
    }),
  });
}

// ---------------------------------------------------------------------------
// MEMBERSHIP
// ---------------------------------------------------------------------------

export async function getMemberships() {
  return apiRequest("/membership/");
}

export async function getMembership(memberId) {
  return apiRequest(
    `/membership/${encodeURIComponent(memberId)}/`,
  );
}

export async function createMembership(
  membershipData,
) {
  return apiRequest("/membership/", {
    method: "POST",
    body: JSON.stringify(membershipData),
  });
}

export async function updateMembership(
  memberId,
  membershipData,
) {
  return apiRequest(
    `/membership/${encodeURIComponent(memberId)}/`,
    {
      method: "PATCH",
      body: JSON.stringify(membershipData),
    },
  );
}

// ---------------------------------------------------------------------------
// PAYMENTS
// ---------------------------------------------------------------------------

export async function getPayments() {
  return apiRequest("/membership/payments/");
}

export async function getMemberPayments(memberId) {
  return apiRequest(
    `/membership/payments/member/${encodeURIComponent(
      memberId,
    )}/`,
  );
}

export async function createPayment(paymentData) {
  return apiRequest("/membership/payments/", {
    method: "POST",
    body: JSON.stringify(paymentData),
  });
}

export async function deletePayment(paymentId) {
  return apiRequest(
    `/membership/payments/${encodeURIComponent(
      paymentId,
    )}/`,
    {
      method: "DELETE",
    },
  );
}

// ---------------------------------------------------------------------------
// MEMBER NOTES
// ---------------------------------------------------------------------------

export async function getMemberNotes(memberId) {
  return apiRequest(
    `/notes/member/${encodeURIComponent(memberId)}/`,
  );
}

export async function createNote(noteData) {
  return apiRequest("/notes/", {
    method: "POST",
    body: JSON.stringify(noteData),
  });
}

export async function updateNote(
  noteId,
  noteData,
) {
  return apiRequest(
    `/notes/${encodeURIComponent(noteId)}/`,
    {
      method: "PATCH",
      body: JSON.stringify(noteData),
    },
  );
}

export async function deleteNote(noteId) {
  return apiRequest(
    `/notes/${encodeURIComponent(noteId)}/`,
    {
      method: "DELETE",
    },
  );
}

// ---------------------------------------------------------------------------
// PASSWORD
// ---------------------------------------------------------------------------

export async function changePassword(
  oldPassword,
  newPassword,
) {
  return apiRequest("/auth/password/change/", {
    method: "POST",
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
    }),
  });
}

