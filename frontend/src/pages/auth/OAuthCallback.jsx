import { useEffect, useState } from "react";
export default function OAuthCallback() {
  const [message, setMessage] = useState("Completing secure sign-in…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ticket");
    if (!ticket) { setMessage(params.get("error") || "Sign-in failed."); return; }
    window.history.replaceState({}, "", "/oauth/callback");
    const api = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
    fetch(`${api}/api/auth/oauth/exchange`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket }) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.message || "Sign-in failed"); return data; })
      .then(({token,user}) => {
        sessionStorage.setItem("nexacore_auth_token",token);
        sessionStorage.setItem("nexacore_auth_user",JSON.stringify(user));
        const paths = { STUDENT: "/student/dashboard", TUTOR: "/tutor/dashboard", TALENT: "/talent/dashboard", CLIENT: "/client/dashboard", SERVICE_PROVIDER: "/member/dashboard", ADMIN: "/admin" };
        window.location.replace(user.role === "ADMIN" ? "/admin" : user.onboardingCompletedAt ? (paths[user.role] || "/onboarding") : "/onboarding");
      }).catch(error => setMessage(error.message));
  }, []);
  return <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-8"><div role="status">{message} <a className="underline" href="/login">Return to login</a></div></main>;
}
