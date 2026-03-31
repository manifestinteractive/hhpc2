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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function MissionStatCard({
  label,
  value,
  detail,
  helpContent,
  helpTitle,
  icon: Icon,
  size = "default",
}: {
  detail: string;
  helpContent?: ReactNode;
  helpTitle?: string;
  icon: LucideIcon;
  label: string;
  size?: "compact" | "default";
  value: ReactNode;
}) {
  const isCompact = size === "compact";

  return (
    <Card className="border-border/80 bg-card/95 shadow-sm">
      <CardHeader
        className={`relative flex flex-row items-start justify-between gap-0 ${isCompact ? "px-4 pt-4 pb-0" : "pb-0"}`}
      >
        <div className={detail !== '' ? "space-y-0" : isCompact ? "space-y-2" : "space-y-4"}>
          <p
            className={`text-muted-foreground font-medium uppercase ${isCompact ? "text-[10px] tracking-[0.16em]" : "text-xs tracking-[0.18em]"}`}
          >
            {label}
          </p>
          <CardTitle
            className={detail !== '' ? (isCompact ? "text-xl" : "text-2xl") : isCompact ? "text-3xl" : "text-5xl"}
          >
            {value}
          </CardTitle>
        </div>
        <div
          className={`bg-transparent text-foreground absolute right-0 rounded-full ${isCompact ? "top-2 p-1.5" : "-top-4 p-2.5"}`}
        >
          <Icon className={isCompact ? "size-4.5" : "size-6"} />
        </div>
      </CardHeader>
      <CardContent className={`relative ${isCompact ? "px-4 pb-4 pt-2" : ""}`}>
        <p className={`text-muted-foreground ${isCompact ? "text-xs leading-5" : "text-sm leading-6"}`}>{detail}</p>
        {helpContent ? (
          <Popover>
            <Tooltip>
              <TooltipTrigger
                render={(
                  <PopoverTrigger
                    aria-label={`Explain ${label.toLowerCase()}`}
                    className={`absolute inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isCompact ? "right-1 bottom-1 size-6" : "right-2 -bottom-2 size-7"}`}
                  />
                )}
              >
                <CircleQuestionMark className={isCompact ? "size-3.5" : "size-4"} />
              </TooltipTrigger>
              <TooltipContent>Explain {label.toLowerCase()}</TooltipContent>
            </Tooltip>
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
