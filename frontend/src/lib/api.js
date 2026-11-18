
const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:4000"
).replace(/\/+$/, "");

async function request(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token
      ? { Authorization: `Bearer ${options.token}` }
      : {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    ...(options.body
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || `Request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export function registerUser(details) {
  return request("/api/auth/register", {
    method: "POST",
    body: details,
  });
}

export function loginUser(details) {
  return request("/api/auth/login", {
    method: "POST",
    body: details,
  });
}

export function initializeCoursePayment({ token, courseId, tutorId, plan, currency = "NGN" }) {
  return request("/api/payments/initialize", { method: "POST", token, body: { courseId, tutorId, plan, currency } });
}

export function verifyCoursePayment({ token, reference }) {
  return request("/api/payments/verify", { method: "POST", token, body: { reference } });
}

export function getServerEnrollments(token) {
  return request("/api/payments/enrollments", { token });
}

// Requires a signed-in user and explicit password confirmation.
export function deleteMyAccount({ token, password, confirmation }) {
  return request("/api/auth/account", {
    method: "DELETE",
    token,
    body: { password, confirmation },
  });
}

export function resendVerificationEmail(email) {
  return request("/api/auth/resend-verification", { method: "POST", body: { email } });
}

export function getCourseTutors({ token, courseId }) {
  return request(`/api/payments/courses/${encodeURIComponent(courseId)}/tutors`, { token });
}
