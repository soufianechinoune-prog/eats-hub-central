import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerfChannel } from "@/hooks/useRestaurantPerformance";
import { CHANNEL_META } from "./channelMeta";

interface Props {
  byChannel: { canal: PerfChannel; ca: number }[];
  total: number;
}

export function ChannelMixBar({ byChannel, total }: Props) {
  const parts = byChannel.filter((c) => c.ca > 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Mix canal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {total > 0 &&
            parts.map((p) => (
              <div
                key={p.canal}
                style={{ width: `${(p.ca / total) * 100}%`, background: CHANNEL_META[p.canal].color }}
                title={CHANNEL_META[p.canal].label}
              />
            ))}
        </div>
        <ul className="space-y-2 text-sm">
          {byChannel.map((p) => (
            <li key={p.canal} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL_META[p.canal].color }} />
                {CHANNEL_META[p.canal].label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {total > 0 ? `${((p.ca / total) * 100).toFixed(1).replace(".", ",")} %` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
