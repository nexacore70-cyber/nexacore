export const TALENT_STORAGE_KEYS = {
  profile: "nexacore_talent_profile_v1",
  publicProfiles: "nexacore_talent_public_profiles_v1",
  jobs: "nexacore_talent_jobs_v1",
  bids: "nexacore_client_bids_v1",
  savedJobs: "nexacore_talent_saved_jobs_v1",
  portfolio: "nexacore_talent_portfolio_v1",
  messages: "nexacore_client_messages_v1",
  availability: "nexacore_talent_availability_v1",
  subscription: "nexacore_talent_subscription_v1",
  payout: "nexacore_talent_payout_v1",
  notifications: "nexacore_talent_notifications_v1",
  clientProjects: "nexacore_client_projects_v1",
  clientPayments: "nexacore_client_payments_v1",
  clientFiles: "nexacore_client_files_v1",
  clientReviews: "nexacore_client_reviews_v1",
};

export const TALENT_SHARE_PERCENT = 80;
export const NEXACORE_SHARE_PERCENT = 20;

export const defaultTalentProfile = {
};

export const defaultPortfolio = [
];

export const defaultMatchingJobs = [
];

export const defaultTalentBids = [
];

export const defaultAvailability = {
  status: "available",
  acceptingNewProjects: true,
  weeklyCapacityHours: 30,
  preferredProjectSize: "medium",
  preferredMinimumBudget: 1000,
  preferredCurrency: "USD",
  timezone: "Africa/Lagos",
  responseWindowHours: 2,
  vacationMode: false,
  vacationStart: "",
  vacationEnd: "",
  workingDays: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ],
  workingStart: "09:00",
  workingEnd: "18:00",
};

export const subscriptionPlans = [
  {
    id: "starter",
    name: "Starter",
    monthlyPriceUsd: 0,
    description:
      "Build a public profile, send proposals and receive project calls.",
    features: [
      "Unlimited job browsing",
      "Up to 10 active proposals",
      "Public portfolio",
      "Direct client messages",
      "Voice and video calls",
      "Secure escrow visibility",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPriceUsd: 19,
    description:
      "Advanced tools for active independent professionals.",
    features: [
      "Everything in Starter",
      "Unlimited active proposals",
      "AI proposal assistant",
      "Advanced job-fit explanations",
      "Portfolio analytics",
      "Priority profile review",
      "Priority support",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyPriceUsd: 49,
    description:
      "Collaboration, team visibility and higher-capacity delivery.",
    features: [
      "Everything in Professional",
      "Team portfolio",
      "Multi-member project rooms",
      "Shared availability",
      "Client presentation pages",
      "Studio earnings analytics",
      "Dedicated support",
    ],
  },
];

export const defaultSubscription = {
  planId: "starter",
  status: "active",
  startedAt: "2026-07-01T00:00:00",
  renewsAt: "",
  paymentReference: "",
};

export const defaultPayout = {
  currency: "USD",
  method: "bank",
  bankName: "",
  accountName: "",
  accountNumber: "",
  routingCode: "",
  country: "Nigeria",
  verified: false,
  payoutRequests: [],
};

export const defaultTalentMessages = {
};

export const defaultTalentRatings = [
];

export const defaultNotifications = [
];

export const fallbackClientProjects = [
];

export const fallbackClientPayments = [];

export const fallbackClientFiles = [
];

export function loadTalentValue(key, fallback) {
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

export function saveTalentValue(key, value) {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    // The prototype remains usable when browser storage is unavailable.
  }
}

export function formatTalentMoney(
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

export function getTalentInitials(profile) {
  return `${profile.firstName?.[0] || "T"}${
    profile.lastName?.[0] || ""
  }`.toUpperCase();
}

export function getMatchingJob(jobs, jobId) {
  return jobs.find((job) => job.id === jobId);
}

export function getTalentBid(bids, bidId) {
  return bids.find((bid) => bid.id === bidId);
}

export function getTalentBidForProject(
  bids,
  projectId,
  talentId,
) {
  return bids.find(
    (bid) =>
      bid.projectId === projectId &&
      bid.talentId === talentId,
  );
}

export function calculateTalentProjectMoney(project) {
  const total = Number(project?.budget || 0);
  const verifiedClientFunds =
    Number(project?.depositPaid || 0) +
    Number(project?.finalPaid || 0);

  const securedTalentShare = Math.round(
    verifiedClientFunds *
      (TALENT_SHARE_PERCENT / 100),
  );

  const totalTalentShare = Math.round(
    total * (TALENT_SHARE_PERCENT / 100),
  );

  const nexacoreShare =
    total - totalTalentShare;

  const available =
    project?.payoutStatus === "released"
      ? Number(
          project.talentPayoutAmount ||
            totalTalentShare,
        )
      : 0;

  const pendingApproval =
    project?.escrowStatus === "fully_funded" &&
    project?.payoutStatus !== "released"
      ? totalTalentShare
      : 0;

  return {
    total,
    verifiedClientFunds,
    securedTalentShare,
    totalTalentShare,
    nexacoreShare,
    available,
    pendingApproval,
  };
}

export function getTalentEarningsSummary(projects, talentId) {
  return projects
    .filter(
      (project) =>
        project.selectedTalentId === talentId,
    )
    .reduce(
      (summary, project) => {
        const amounts =
          calculateTalentProjectMoney(project);

        return {
          available:
            summary.available + amounts.available,
          pendingApproval:
            summary.pendingApproval +
            amounts.pendingApproval,
          securedInEscrow:
            summary.securedInEscrow +
            Math.max(
              0,
              amounts.securedTalentShare -
                amounts.available,
            ),
          lifetime:
            summary.lifetime + amounts.available,
        };
      },
      {
        available: 0,
        pendingApproval: 0,
        securedInEscrow: 0,
        lifetime: 0,
      },
    );
}

export function publishTalentProfile(
  profile,
  portfolio,
  availability,
  ratings = defaultTalentRatings,
) {
  const registry = loadTalentValue(
    TALENT_STORAGE_KEYS.publicProfiles,
    {},
  );

  const rating =
    ratings.length > 0
      ? Number(
          (
            ratings.reduce(
              (sum, item) =>
                sum + Number(item.rating || 0),
              0,
            ) / ratings.length
          ).toFixed(1),
        )
      : Number(profile.rating || 0);

  const publicProfile = {
    id: profile.id,
    name:
      profile.displayName ||
      `${profile.firstName} ${profile.lastName}`,
    initials: getTalentInitials(profile),
    title: profile.title,
    location: profile.location,
    timezone: availability.timezone,
    hourlyRate: Number(profile.hourlyRate || 0),
    currency: profile.currency || "USD",
    rating,
    completedProjects: Number(
      profile.completedProjects || 0,
    ),
    responseTime: `${availability.responseWindowHours}-hour response target`,
    verified: Boolean(profile.verified),
    available:
      availability.status === "available" &&
      availability.acceptingNewProjects &&
      !availability.vacationMode,
    skills: profile.skills || [],
    bio: profile.bio,
    reviews: ratings.map((review) => ({
      id: review.id,
      client: review.clientName,
      rating: review.rating,
      text: review.comment,
    })),
    portfolio: portfolio
      .filter(
        (item) => item.visibility === "public",
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: item.category,
        image:
          item.image ||
          "/images/hero/banner1.png",
        description: item.description,
        liveUrl: item.liveUrl,
        repositoryUrl: item.repositoryUrl,
        skills: item.skills,
      })),
    updatedAt: new Date().toISOString(),
  };

  saveTalentValue(
    TALENT_STORAGE_KEYS.publicProfiles,
    {
      ...registry,
      [profile.id]: publicProfile,
    },
  );

  return publicProfile;
}

export function beginTalentAccount({
  firstName,
  lastName,
  email,
  phone,
  professionalSkill,
}) {
  const profile = {
    ...defaultTalentProfile,
    id: `TAL-${Date.now()}`,
    firstName:
      String(firstName || "").trim() || "Talent",
    lastName:
      String(lastName || "").trim() ||
      "Professional",
    displayName: `${String(
      firstName || "Talent",
    ).trim()} ${String(
      lastName || "Professional",
    ).trim()}`.trim(),
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
    primaryService:
      String(professionalSkill || "").trim() ||
      "Technology Professional",
    title: `${
      String(professionalSkill || "").trim() ||
      "Technology"
    } Professional`,
    profilePublished: false,
    verified: false,
    completedProjects: 0,
    rating: 0,
  };

  saveTalentValue(
    TALENT_STORAGE_KEYS.profile,
    profile,
  );

  saveTalentValue(
    TALENT_STORAGE_KEYS.portfolio,
    [],
  );

  saveTalentValue(
    TALENT_STORAGE_KEYS.availability,
    defaultAvailability,
  );

  saveTalentValue(
    TALENT_STORAGE_KEYS.subscription,
    defaultSubscription,
  );

  window.location.href = "/talent/portfolio";
}

export function getTalentLandingPath() {
  const profile = loadTalentValue(
    TALENT_STORAGE_KEYS.profile,
    defaultTalentProfile,
  );

  if (!profile.profilePublished) {
    return "/talent/portfolio";
  }

  return "/talent/dashboard";
}
