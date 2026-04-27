import { redirect } from "next/navigation";

export default function SimpleChatRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/chat/${params.id}`);
}
