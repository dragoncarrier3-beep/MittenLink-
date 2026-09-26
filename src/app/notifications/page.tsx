import type { Metadata } from "next";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { asCurrentUser, requireUser } from "@/lib/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Pagination, parsePage } from "@/components/common/pagination";
import { StatusPill } from "@/components/common/badges";
import { SubmitButton } from "@/components/forms/fields";
import { firstParam, type SearchParams } from "@/components/community/server";
import { markAllNotificationsReadAction, markNotificationReadAction, openNotificationAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 20;

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: Date | null;
  created_at: Date;
}

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/notifications");
  const params = await searchParams;
  const page = parsePage(params.page);
  const { rows, total, unread } = await asCurrentUser(async (sql) => {
    const [counts] = await sql.query<{ total: number; unread: number }>(
      "select count(*)::int as total, (count(*) filter (where read_at is null))::int as unread from public.notifications where user_id = auth.uid()",
    );
    const rows = await sql.query<NotificationRow>(
      `select id, title, body, link_url, read_at, created_at from public.notifications
       where user_id = auth.uid() order by created_at desc limit $1 offset $2`,
      [PAGE_SIZE, (page - 1) * PAGE_SIZE],
    );
    return { rows, total: counts?.total ?? 0, unread: counts?.unread ?? 0 };
  });

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Notifications"
        description={unread ? `You have ${unread} unread ${unread === 1 ? "notification" : "notifications"}.` : "You're all caught up."}
        breadcrumbs={[{ label: "My Account", href: "/account" }, { label: "Notifications" }]}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <SubmitButton variant="outline" pendingLabel="Marking…">
                <CheckCheck aria-hidden /> Mark all read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />
      {firstParam(params.allread) === "1" && (
        <p role="status" className="mb-4 rounded-lg border border-success/40 bg-success-soft p-3 font-semibold text-success">
          All notifications are marked as read.
        </p>
      )}
      {firstParam(params.error) === "1" && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger-soft p-3 font-semibold text-danger">
          We couldn&apos;t update that notification. Please try again.
        </p>
      )}
      {total === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Updates about your claims, reports, and listings will appear here." action={{ label: "Go to My Account", href: "/account" }} />
      ) : (
        <>
          <ul className="flex max-w-3xl flex-col gap-3">
            {rows.map((n) => {
              const isUnread = !n.read_at;
              return (
                <li key={n.id}>
                  <article
                    aria-labelledby={`n-${n.id}`}
                    className={cn("rounded-xl border bg-card p-4 shadow-sm", isUnread && "border-l-4 border-l-primary bg-secondary/40")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 id={`n-${n.id}`} className={cn("text-lg", isUnread ? "font-bold" : "font-semibold")}>
                        {n.title}
                      </h2>
                      {isUnread ? <StatusPill tone="info">Unread</StatusPill> : <span className="text-sm text-muted-foreground">Read</span>}
                    </div>
                    {n.body && <p className="mt-1">{n.body}</p>}
                    <p className="mt-1 text-sm text-muted-foreground">
                      <time dateTime={new Date(n.created_at).toISOString()} title={formatDateTime(n.created_at)}>
                        {formatRelative(n.created_at)}
                      </time>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {n.link_url && (
                        <form action={openNotificationAction}>
                          <input type="hidden" name="id" value={n.id} />
                          <SubmitButton size="sm" pendingLabel="Opening…">
                            <ExternalLink aria-hidden /> Open<span className="sr-only">: {n.title}</span>
                          </SubmitButton>
                        </form>
                      )}
                      {isUnread && (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="id" value={n.id} />
                          <SubmitButton size="sm" variant="outline" pendingLabel="Marking…">
                            Mark read<span className="sr-only">: {n.title}</span>
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/notifications?page=${p}`} label="Notification pages" />
        </>
      )}
    </div>
  );
}
