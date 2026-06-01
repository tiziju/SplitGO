import { redirect } from "next/navigation";

// /expenses/new → /expenses/add  (renamed to avoid "new" JS reserved-word bundler issue)
export default function RedirectPage() {
  redirect("../add");
}
