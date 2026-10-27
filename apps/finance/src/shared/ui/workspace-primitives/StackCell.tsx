"use client";

import type { ReactNode } from "react";
import { TableCellStack } from "@/shared/ui/ClinicTable";

export function StackCell({ avatar, primary, secondary, badge }: { avatar?: ReactNode; primary: ReactNode; secondary?: ReactNode; badge?: ReactNode }) {
  return <TableCellStack avatar={avatar} primary={primary} secondary={secondary} badge={badge} />;
}
