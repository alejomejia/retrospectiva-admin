import { redirect } from "next/navigation";

export async function GET() {
  redirect(`/settings/products`);
}
