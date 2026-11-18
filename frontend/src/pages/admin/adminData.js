export const ADMIN_STORAGE_KEYS = {

  session: "nexacore_admin_session_v1",

  users: "nexacore_admin_users_v1",

  kyc: "nexacore_admin_kyc_v1",

  courses: "nexacore_admin_courses_v1",

  disputes: "nexacore_admin_disputes_v1",

  categories: "nexacore_admin_categories_v1",

  staff: "nexacore_admin_staff_v1",

  audit: "nexacore_admin_audit_v1",

  settings: "nexacore_admin_settings_v1",

  reports: "nexacore_admin_reports_v1",

  notifications: "nexacore_admin_notifications_v1",

  clientProjects: "nexacore_client_projects_v1",

  clientPayments: "nexacore_client_payments_v1",

  clientSupport: "nexacore_client_support_v1",

  clientFiles: "nexacore_client_files_v1",

  clientReviews: "nexacore_client_reviews_v1",

  clientProfile: "nexacore_client_profile_v1",

  talentProfile: "nexacore_talent_profile_v1",

  talentPublicProfiles: "nexacore_talent_public_profiles_v1",

  tutorProfile: "nexacore_tutor_profile_v1",

  tutorOnboarding: "nexacore_tutor_onboarding_v1",

  tutorAgreement: "nexacore_tutor_agreement_v1",

  studentProfile: "nexacore_student_profile_v3",

  studentEnrollments: "nexacore_student_enrollments_v3",

};



export const ADMIN_ROLES = {

  SUPER_ADMIN: "SUPER_ADMIN",

  OPERATIONS_ADMIN: "OPERATIONS_ADMIN",

  KYC_OFFICER: "KYC_OFFICER",

  ACADEMY_MANAGER: "ACADEMY_MANAGER",

  FINANCE_OFFICER: "FINANCE_OFFICER",

  SUPPORT_AGENT: "SUPPORT_AGENT",

  ANALYST: "ANALYST",

};



export const ADMIN_ROLE_LABELS = {

  SUPER_ADMIN: "Super Admin",

  OPERATIONS_ADMIN: "Operations Admin",

  KYC_OFFICER: "KYC Officer",

  ACADEMY_MANAGER: "Academy Manager",

  FINANCE_OFFICER: "Finance Officer",

  SUPPORT_AGENT: "Support Agent",

  ANALYST: "Reporting Analyst",

};



export const ADMIN_PERMISSIONS = {

  DASHBOARD_VIEW: "dashboard.view",

  USERS_VIEW: "users.view",

  USERS_MANAGE: "users.manage",

  USERS_SUSPEND: "users.suspend",

  KYC_VIEW: "kyc.view",

  KYC_REVIEW: "kyc.review",

  COURSES_VIEW: "courses.view",

  COURSES_MANAGE: "courses.manage",

  PROJECTS_VIEW: "projects.view",

  PROJECTS_INTERVENE: "projects.intervene",

  DISPUTES_VIEW: "disputes.view",

  DISPUTES_RESOLVE: "disputes.resolve",

  PAYMENTS_VIEW: "payments.view",

  PAYMENTS_RECONCILE: "payments.reconcile",

  PAYMENTS_RELEASE: "payments.release",

  REPORTS_VIEW: "reports.view",

  REPORTS_EXPORT: "reports.export",

  CATEGORIES_VIEW: "categories.view",

  CATEGORIES_MANAGE: "categories.manage",

  SUPPORT_VIEW: "support.view",

  SUPPORT_MANAGE: "support.manage",

  STAFF_VIEW: "staff.view",

  STAFF_MANAGE: "staff.manage",

  AUDIT_VIEW: "audit.view",

  SETTINGS_VIEW: "settings.view",

  SETTINGS_MANAGE: "settings.manage",

  MODERATION_LIMITED: "moderation.limited",

};



const allPermissions = Object.values(ADMIN_PERMISSIONS);



export const ROLE_PERMISSIONS = {

  SUPER_ADMIN: allPermissions,

  OPERATIONS_ADMIN: [

    ADMIN_PERMISSIONS.DASHBOARD_VIEW,

    ADMIN_PERMISSIONS.USERS_VIEW,

    ADMIN_PERMISSIONS.USERS_MANAGE,

    ADMIN_PERMISSIONS.USERS_SUSPEND,

    ADMIN_PERMISSIONS.KYC_VIEW,

    ADMIN_PERMISSIONS.COURSES_VIEW,

    ADMIN_PERMISSIONS.PROJECTS_VIEW,

    ADMIN_PERMISSIONS.PROJECTS_INTERVENE,

    ADMIN_PERMISSIONS.DISPUTES_VIEW,

    ADMIN_PERMISSIONS.DISPUTES_RESOLVE,

    ADMIN_PERMISSIONS.PAYMENTS_VIEW,

    ADMIN_PERMISSIONS.REPORTS_VIEW,

    ADMIN_PERMISSIONS.CATEGORIES_VIEW,

    ADMIN_PERMISSIONS.SUPPORT_VIEW,

    ADMIN_PERMISSIONS.SUPPORT_MANAGE,

    ADMIN_PERMISSIONS.AUDIT_VIEW,

    ADMIN_PERMISSIONS.MODERATION_LIMITED,

  ],

  KYC_OFFICER: [

    ADMIN_PERMISSIONS.DASHBOARD_VIEW,

    ADMIN_PERMISSIONS.USERS_VIEW,

    ADMIN_PERMISSIONS.KYC_VIEW,

    ADMIN_PERMISSIONS.KYC_REVIEW,

    ADMIN_PERMISSIONS.AUDIT_VIEW,

  ],

  ACADEMY_MANAGER: [

    ADMIN_PERMISSIONS.DASHBOARD_VIEW,

    ADMIN_PERMISSIONS.USERS_VIEW,

    ADMIN_PERMISSIONS.COURSES_VIEW,

    ADMIN_PERMISSIONS.COURSES_MANAGE,

    ADMIN_PERMISSIONS.CATEGORIES_VIEW,

    ADMIN_PERMISSIONS.CATEGORIES_MANAGE,

    ADMIN_PERMISSIONS.REPORTS_VIEW,

    ADMIN_PERMISSIONS.SUPPORT_VIEW,

    ADMIN_PERMISSIONS.AUDIT_VIEW,

  ],

  FINANCE_OFFICER: [

    ADMIN_PERMISSIONS.DASHBOARD_VIEW,

    ADMIN_PERMISSIONS.USERS_VIEW,

    ADMIN_PERMISSIONS.PROJECTS_VIEW,

    ADMIN_PERMISSIONS.DISPUTES_VIEW,

    ADMIN_PERMISSIONS.PAYMENTS_VIEW,

    ADMIN_PERMISSIONS.PAYMENTS_RECONCILE,

    ADMIN_PERMISSIONS.PAYMENTS_RELEASE,

    ADMIN_PERMISSIONS.REPORTS_VIEW,

    ADMIN_PERMISSIONS.REPORTS_EXPORT,

    ADMIN_PERMISSIONS.AUDIT_VIEW,

  ],

  SUPPORT_AGENT: [

    ADMIN_PERMISSIONS.DASHBOARD_VIEW,

    ADMIN_PERMISSIONS.USERS_VIEW,

    ADMIN_PERMISSIONS.PROJECTS_VIEW,

    ADMIN_PERMISSIONS.DISPUTES_VIEW,

    ADMIN_PERMISSIONS.SUPPORT_VIEW,

    ADMIN_PERMISSIONS.SUPPORT_MANAGE,

    ADMIN_PERMISSIONS.MODERATION_LIMITED,

  ],

  ANALYST: [

    ADMIN_PERMISSIONS.DASHBOARD_VIEW,

    ADMIN_PERMISSIONS.USERS_VIEW,

    ADMIN_PERMISSIONS.KYC_VIEW,

    ADMIN_PERMISSIONS.COURSES_VIEW,

    ADMIN_PERMISSIONS.PROJECTS_VIEW,

    ADMIN_PERMISSIONS.DISPUTES_VIEW,

    ADMIN_PERMISSIONS.PAYMENTS_VIEW,

    ADMIN_PERMISSIONS.REPORTS_VIEW,

    ADMIN_PERMISSIONS.REPORTS_EXPORT,

    ADMIN_PERMISSIONS.CATEGORIES_VIEW,

    ADMIN_PERMISSIONS.SUPPORT_VIEW,

  ],

};



export const defaultAdminSettings = {

  platformName: "NexaCore",

  supportEmail: "support@nexacore.com",

  securityEmail: "security@nexacore.com",

  primaryCurrency: "NGN",

  academyTutorSharePercent: 60,

  academyPlatformSharePercent: 40,

  serviceDepositPercent: 25,

  serviceFinalPercent: 75,

  serviceTalentSharePercent: 90,

  servicePlatformSharePercent: 10,

  automaticPayoutEnabled: false,

  payoutReviewThresholdUsd: 5000,

  kycRequiredForTalent: true,

  kycRequiredForTutors: true,

  maintenanceMode: false,

  registrationsEnabled: true,

  courseEnrollmentEnabled: true,

  projectPostingEnabled: true,

  emergencyPaymentHold: false,

};



export const defaultAdminStaff = [];



export const defaultAdminUsers = [];



export const defaultKycCases = [];



export const defaultAdminCourses = [];



export const defaultAdminCategories = [];



export const defaultDisputes = [];



export const defaultAdminAudit = [];



export const defaultAdminNotifications = [];



export const fallbackProjects = [];



export const fallbackPayments = [];



export const fallbackSupportTickets = [];



export function loadAdminValue(key, fallback) {

  try {

    const stored = window.localStorage.getItem(key);



    if (!stored) {

      return fallback;

    }



    const parsed = JSON.parse(stored);



    if (

      fallback &&

      typeof fallback === "object" &&

      !Array.isArray(fallback) &&

      parsed &&

      typeof parsed === "object" &&

      !Array.isArray(parsed)

    ) {

      return {

        ...fallback,

        ...parsed,

      };

    }



    return parsed;

  } catch {

    return fallback;

  }

}



export function saveAdminValue(key, value) {

  try {

    window.localStorage.setItem(

      key,

      JSON.stringify(value),

    );

  } catch {

    // The local preview remains usable if browser storage is unavailable.

  }

}



export function loadAdminSession() {

  try {

    const stored = window.sessionStorage.getItem(

      ADMIN_STORAGE_KEYS.session,

    );



    return stored ? JSON.parse(stored) : null;

  } catch {

    return null;

  }

}



export function saveAdminSession(session) {

  try {

    window.sessionStorage.setItem(

      ADMIN_STORAGE_KEYS.session,

      JSON.stringify(session),

    );

  } catch {

    // Production sessions must be stored in secure HttpOnly cookies.

  }

}



export function clearAdminSession() {

  try {

    window.sessionStorage.removeItem(

      ADMIN_STORAGE_KEYS.session,

    );

  } catch {

    // No action required.

  }

}



export function isAdminPreviewEnabled() {

  return (

    String(

      import.meta.env?.VITE_NEXACORE_ADMIN_PREVIEW_MODE ||

        "",

    ).toLowerCase() === "true"

  );

}



function getPreviewCredentials() {

  return {

    email:

      import.meta.env

        ?.VITE_NEXACORE_ADMIN_PREVIEW_EMAIL ||

      "",

    accessCode:

      import.meta.env

        ?.VITE_NEXACORE_ADMIN_PREVIEW_CODE ||

      "",

  };

}



const adminApiBase = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");



export async function authenticateAdmin({ email, accessCode }) {

  const response = await fetch(`${adminApiBase}/api/admin/auth/login`, {

    method: "POST", headers: { "Content-Type": "application/json" },

    credentials: "include", body: JSON.stringify({ email: String(email || "").trim().toLowerCase(), password: accessCode }),

  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(payload.message || "Administrator authentication failed.");

  return payload.session;

}



export async function resolveAdminSession() {

  try {

    const response = await fetch(`${adminApiBase}/api/admin/auth/session`, { credentials: "include" });

    if (!response.ok) return null;

    const payload = await response.json();

    return payload.session;

  } catch { return null; }

}



export async function logoutAdmin() {

  try { await fetch(`${adminApiBase}/api/admin/auth/logout`, { method: "POST", credentials: "include" }); }

  finally { clearAdminSession(); }

}



export function hasAdminPermission(

  session,

  permission,

) {

  if (!session) {

    return false;

  }



  if (session.role === ADMIN_ROLES.SUPER_ADMIN) {

    return true;

  }



  return Boolean(

    session.permissions?.includes(permission),

  );

}



export function getAdminLandingPath(session) {

  if (!session) {

    return "/admin/login";

  }



  return "/admin/dashboard";

}



export function writeAuditLog({

  session,

  action,

  targetType,

  targetId,

  summary,

}) {

  const logs = loadAdminValue(

    ADMIN_STORAGE_KEYS.audit,

    defaultAdminAudit,

  );



  const entry = {

    id: `AUD-${Date.now()}`,

    actorId: session?.staffId || "UNKNOWN",

    actorName: session?.name || "Unknown staff",

    action,

    targetType,

    targetId,

    summary,

    ipAddress: "local-preview",

    createdAt: new Date().toISOString(),

  };



  saveAdminValue(ADMIN_STORAGE_KEYS.audit, [

    entry,

    ...logs,

  ]);



  return entry;

}



export function formatAdminMoney(

  value,

  currency = "USD",

) {

  return new Intl.NumberFormat(

    currency === "NGN" ? "en-NG" : "en-US",

    {

      style: "currency",

      currency,

      maximumFractionDigits: 0,

    },

  ).format(Number(value || 0));

}



export function exportRowsToCsv(

  filename,

  rows,

) {

  if (!Array.isArray(rows) || rows.length === 0) {

    return false;

  }



  const headers = Array.from(

    rows.reduce((set, row) => {

      Object.keys(row || {}).forEach((key) =>

        set.add(key),

      );



      return set;

    }, new Set()),

  );



  const escapeCell = (value) => {

    const normalised =

      value === null || value === undefined

        ? ""

        : typeof value === "object"

          ? JSON.stringify(value)

          : String(value);



    return `"${normalised.replaceAll('"', '""')}"`;

  };



  const csv = [

    headers.map(escapeCell).join(","),

    ...rows.map((row) =>

      headers

        .map((header) => escapeCell(row[header]))

        .join(","),

    ),

  ].join("\n");



  const blob = new Blob([csv], {

    type: "text/csv;charset=utf-8",

  });



  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = filename;

  anchor.click();

  URL.revokeObjectURL(url);



  return true;

}



export function collectPlatformSnapshot() {

  const users = loadAdminValue(

    ADMIN_STORAGE_KEYS.users,

    defaultAdminUsers,

  );



  const kyc = loadAdminValue(

    ADMIN_STORAGE_KEYS.kyc,

    defaultKycCases,

  );



  const courses = loadAdminValue(

    ADMIN_STORAGE_KEYS.courses,

    defaultAdminCourses,

  );



  const projects = loadAdminValue(

    ADMIN_STORAGE_KEYS.clientProjects,

    fallbackProjects,

  );



  const payments = loadAdminValue(

    ADMIN_STORAGE_KEYS.clientPayments,

    fallbackPayments,

  );



  const disputes = loadAdminValue(

    ADMIN_STORAGE_KEYS.disputes,

    defaultDisputes,

  );



  const support = loadAdminValue(

    ADMIN_STORAGE_KEYS.clientSupport,

    fallbackSupportTickets,

  );



  const categories = loadAdminValue(

    ADMIN_STORAGE_KEYS.categories,

    defaultAdminCategories,

  );



  return {

    users,

    kyc,

    courses,

    projects,

    payments,

    disputes,

    support,

    categories,

  };

}
