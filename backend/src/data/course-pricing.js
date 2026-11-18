import crypto from "node:crypto";

const categories = [
  ["software-development", ["Full Stack Development", "Frontend Development", "Backend Development", "Mobile App Development", "API Development", "Software Testing and QA", "Git and GitHub"]],
  ["data-ai", ["Data Analysis", "Data Science", "AI and Machine Learning", "Data Engineering", "Business Intelligence", "SQL", "Power BI", "Tableau", "Excel Analytics", "Python for Data"]],
  ["cybersecurity", ["Cybersecurity Fundamentals", "Ethical Hacking", "Network Security", "Cloud Security", "SOC Analyst Training", "GRC and Risk Management"]],
  ["cloud-devops", ["Cloud Computing", "AWS", "Azure", "Docker", "Kubernetes", "DevOps Engineering", "CI/CD", "Linux Administration"]],
  ["design-product", ["UI/UX Design", "Product Design", "Graphic Design", "Design Systems", "Product Management", "User Research", "Figma Mastery"]],
  ["business-digital", ["Social Media Management", "Digital Marketing", "SEO", "Project Management", "Agile and Scrum", "Tech Sales", "Virtual Assistance", "No-Code Tools"]],
  ["emerging-skills", ["Blockchain Basics", "Prompt Engineering", "AI Automation", "Data Privacy", "Robotics Introduction", "IoT Basics", "Low-Code App Building"]],
  ["videography-creative-media", ["Videography Fundamentals", "Cinematography and Film Production", "Video Editing and Post-Production", "AI Video Creation", "Motion Graphics", "2D Animation", "3D Animation", "Movie Production and Directing", "Documentary Production", "YouTube and Social Media Content Creation", "Sound Design and Audio Post-Production", "VFX and Compositing", "Scriptwriting and Storyboarding"]],
  ["professional-soft-skills", ["Communication and Public Speaking", "Leadership and Team Management", "Critical Thinking and Problem Solving", "Emotional Intelligence", "Time Management and Productivity", "Career Development and Personal Branding", "Business Writing and Professional Etiquette", "Negotiation and Conflict Resolution", "Customer Service Excellence", "Entrepreneurship and Business Fundamentals", "Remote Work and Collaboration", "Interview and Workplace Readiness"]],
];
const defaults = {"software-development":"professional", "data-ai":"professional", cybersecurity:"advanced", "cloud-devops":"advanced", "design-product":"professional", "business-digital":"foundation", "emerging-skills":"foundation", "videography-creative-media":"professional", "professional-soft-skills":"soft"};
const tiers = {soft:150000, foundation:220000, professional:350000, advanced:500000, specialist:650000, intensive:800000};
const intensive = new Set(["Full Stack Development", "AI and Machine Learning", "DevOps Engineering", "Movie Production and Directing"]);
const specialist = new Set(["Mobile App Development", "Data Science", "Data Engineering", "Ethical Hacking", "Cloud Security", "SOC Analyst Training", "AWS", "Azure", "Kubernetes", "3D Animation", "VFX and Compositing", "Cinematography and Film Production"]);
const advanced = new Set(["Backend Development", "API Development", "Business Intelligence", "Network Security", "GRC and Risk Management", "Cloud Computing", "Docker", "CI/CD", "Linux Administration", "Product Management", "AI Automation", "Robotics Introduction", "IoT Basics", "AI Video Creation", "Motion Graphics", "2D Animation", "Video Editing and Post-Production", "Sound Design and Audio Post-Production"]);
const soft = new Set(["Communication and Public Speaking", "Emotional Intelligence", "Time Management and Productivity", "Career Development and Personal Branding", "Business Writing and Professional Etiquette", "Customer Service Excellence", "Remote Work and Collaboration", "Interview and Workplace Readiness"]);
const catalog = [];
for (const [categoryId, titles] of categories) {
  for (const title of titles) {
    const tier = intensive.has(title) ? "intensive" : specialist.has(title) ? "specialist" : advanced.has(title) ? "advanced" : soft.has(title) ? "soft" : defaults[categoryId] || "professional";
    catalog.push({ id: catalog.length + 1, title, categoryId, amount: tiers[tier] });
  }
}
export function getPricedCourse(courseId) {
  const id = Number(courseId);
  return Number.isInteger(id) ? catalog.find((course) => course.id === id) || null : null;
}
export function amountDue(course, plan, amountPaid) {
  const outstanding = Math.max(0, course.amount - amountPaid);
  if (outstanding === 0) return 0;
  if (amountPaid === 0) {
    if (plan === "two-part") return Math.min(outstanding, Math.ceil(course.amount * 0.6));
    if (plan === "three-part") return Math.min(outstanding, Math.ceil(course.amount * 0.4));
    if (plan === "full") return outstanding;
    throw new Error("Invalid payment plan.");
  }
  if (plan === "two-part") return outstanding;
  if (plan === "three-part") return Math.ceil(outstanding / 2);
  return outstanding;
}
export function newPaymentReference() { return `NX-${Date.now()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`; }
