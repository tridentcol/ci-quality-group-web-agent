import { notFound } from "next/navigation";
import { ConversationView } from "../conversation-view";
import { getConversationDetail } from "@/lib/data/panel";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getConversationDetail(id);
  if (!data) notFound();
  return <ConversationView id={id} initial={data} />;
}
