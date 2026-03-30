import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CircleQuestionMark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

export function MissionStatCard({
  label,
  value,
  detail,
  helpContent,
  helpTitle,
  icon: Icon,
}: {
  detail: string;
  helpContent?: ReactNode;
  helpTitle?: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-0 pb-0">
        <div className={detail !== '' ? "space-y-2" : "space-y-4"}>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.18em]">
            {label}
          </p>
          <CardTitle className={detail !== '' ? "text-2xl" : "text-5xl"}>{value}</CardTitle>
        </div>
        <div className="bg-muted text-foreground rounded-full p-2.5">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-muted-foreground text-sm leading-6">{detail}</p>
        {helpContent ? (
          <Popover>
            <PopoverTrigger
              aria-label={`Explain ${label.toLowerCase()}`}
              className="absolute right-1 -bottom-2 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <CircleQuestionMark className="size-4" />
            </PopoverTrigger>
            <PopoverContent alignOffset={-14}>
              {helpTitle ? <PopoverTitle>{helpTitle}</PopoverTitle> : null}
              <div className="space-y-2 text-sm leading-6 text-muted-foreground">
                {helpContent}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </CardContent>
    </Card>
  );
}
