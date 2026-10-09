import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getAuthenticatedUser } from "@/lib/auth/get-user";
import { getDashboardAnalytics } from "@/lib/analytics/dashboard";
import { MetricCard } from "@/components/ui/metric-card";
import { ChartBars } from "@/components/ui/chart-bars";
import { CampaignStatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const data = await getDashboardAnalytics(user.profile.id);

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <PageHeader
        title="System Performance"
        subtitle={`Real-time engagement across ${data.activeCampaigns.filter((c) => c.status === "active").length} active sequences.`}
        actions={
          <>
            <button
              type="button"
              className="bg-surface-container-lowest border border-outline-variant px-4 py-2 rounded text-label-md flex items-center gap-1 hover:bg-surface-container-high transition-colors"
            >
              <Icon name="calendar_today" size={18} />
              Last 30 Days
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Sent"
          value={data.sentCount.toLocaleString()}
          icon="outbox"
          trend={{ direction: "up", text: "All time" }}
        />
        <MetricCard
          label="Reply Rate"
          value={`${data.replyRate}%`}
          icon="reply_all"
          trend={{ direction: "up", text: `${data.repliedCount} replies` }}
        />
        <MetricCard
          label="Pending Follow-ups"
          value={data.pendingFollowUps.toLocaleString()}
          icon="schedule"
        />
        <MetricCard
          label="Stopped"
          value={data.stoppedCount.toLocaleString()}
          icon="block"
          trend={{ direction: "down", text: "Unsubscribed / stopped" }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-6 rounded">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-headline-sm text-on-surface">Campaign Performance</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-label-sm text-on-surface-variant">Sent</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary-container" />
                <span className="text-label-sm text-on-surface-variant">Replied</span>
              </div>
            </div>
          </div>
          <ChartBars data={data.chartData} />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded">
          <h3 className="text-headline-sm text-on-surface mb-6">Recent Conversions</h3>
          <div className="space-y-6">
            {data.recentReplies.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">No replies yet.</p>
            ) : (
              data.recentReplies.map((reply) => (
                <div key={reply.id} className="flex items-start gap-4">
                  <div className="bg-primary-fixed w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    <Icon name="person" className="text-primary" filled />
                  </div>
                  <div>
                    <p className="text-label-md text-on-surface">
                      {reply.enrollment.prospect.firstName}{" "}
                      {reply.enrollment.prospect.lastName}
                      <span className="text-body-sm text-on-surface-variant ml-1">
                        from {reply.enrollment.prospect.company ?? "—"}
                      </span>
                    </p>
                    <p className="text-body-sm text-on-surface-variant">
                      Replied to{" "}
                      <span className="text-primary font-medium">
                        {reply.enrollment.campaign.name}
                      </span>
                    </p>
                    <p className="text-[10px] uppercase text-label-sm text-tertiary mt-1">
                      {formatDistanceToNow(reply.detectedAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            href="/dashboard/inbox"
            className="block w-full border border-outline-variant py-2 rounded mt-8 text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors text-center"
          >
            View Lead Activity
          </Link>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="text-headline-sm text-on-surface">Active Campaigns</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Emails Sent</TableHead>
              <TableHead className="text-right">Reply Count</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.activeCampaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-on-surface-variant py-8">
                  No campaigns yet.{" "}
                  <Link href="/dashboard/campaigns/new" className="text-primary">
                    Create one
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              data.activeCampaigns.map((campaign) => {
                const sent = campaign.sentCount;
                const replied = campaign.repliedCount;
                const total = campaign._count.enrollments;
                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-2 h-2 rounded-full ${campaign.status === "active" ? "bg-primary animate-pulse" : "bg-secondary"}`}
                        />
                        <div>
                          <p className="font-bold">{campaign.name}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            Created {formatDistanceToNow(campaign.createdAt, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CampaignStatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell>
                      <ProgressBar value={sent} max={total || 1} />
                    </TableCell>
                    <TableCell className="text-right text-label-md">{replied}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/campaigns/${campaign.id}`}
                        className="text-on-surface-variant hover:text-primary"
                      >
                        <Icon name="edit" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
