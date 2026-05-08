import { redirect } from "next/navigation";

/**
 * Root path — there's no public marketing home.
 * Authenticated users land on /dashboard; the middleware bounces
 * unauthenticated visitors to /login.
 */
export default function Home() {
  redirect("/dashboard");
}
