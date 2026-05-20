import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { AiModelStatus } from "@/lib/db/schema";
import { m } from "@/lib/i18n/messages.es";
import { R2_PUBLIC_BASE_URL } from "@/lib/integrations/r2/client";
import { publicUrlFor } from "@/lib/integrations/r2/keys";

const STATUS_VARIANT: Record<
  AiModelStatus,
  "default" | "secondary" | "outline"
> = {
  active: "default",
  draft: "outline",
  archived: "secondary",
};

export type ModelsTableRow = {
  id: string;
  label: string | null;
  status: AiModelStatus;
  ageRange: string;
  bodyType: string;
  hairColor: string;
  hairShape: string;
  hairType: string;
  contactSheetKey: string | null;
  cropsAvailable: boolean;
  /** Used as the thumbnail when crops are available — the face
   *  close-up is the most recognizable shot at small sizes. */
  frontPortraitKey: string | null;
  createdAt: Date;
};

/**
 * Gallery table for `/models`. Each row links into the detail page.
 * Thumbnail prefers `front_portrait.png`; falls back to the contact
 * sheet when crops weren't available; falls back to a placeholder
 * when the run hasn't finished yet (still in `draft` with no keys).
 */
export function ModelsTable({ rows }: { rows: ModelsTableRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-caplet">
          <tr>
            <th className="w-20 px-3 py-2 text-left">{""}</th>
            <th className="px-3 py-2 text-left">
              {m.models.columns.label}
            </th>
            <th className="px-3 py-2 text-left">{m.models.columns.age}</th>
            <th className="px-3 py-2 text-left">{m.models.columns.body}</th>
            <th className="px-3 py-2 text-left">{m.models.columns.hair}</th>
            <th className="px-3 py-2 text-left">
              {m.models.columns.created}
            </th>
            <th className="px-3 py-2 text-left">
              {m.models.columns.status}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const thumbKey = row.frontPortraitKey ?? row.contactSheetKey;
            const thumbUrl = thumbKey
              ? publicUrlFor(thumbKey, R2_PUBLIC_BASE_URL)
              : null;
            return (
              <tr
                key={row.id}
                className="border-t border-border hover:bg-muted/30"
              >
                <td className="px-3 py-2">
                  <Link href={`/models/${row.id}`} className="block">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        alt=""
                        width={56}
                        height={56}
                        className="size-14 rounded-sm object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="size-14 rounded-sm bg-muted" />
                    )}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/models/${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.label ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {m.models.ageRanges[
                    row.ageRange as keyof typeof m.models.ageRanges
                  ] ?? row.ageRange}
                </td>
                <td className="px-3 py-2">
                  {m.models.bodyTypes[
                    row.bodyType as keyof typeof m.models.bodyTypes
                  ] ?? row.bodyType}
                </td>
                <td className="px-3 py-2 max-w-xs truncate">
                  {formatHair(row, m)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.createdAt.toLocaleDateString("es-ES")}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={STATUS_VARIANT[row.status]}>
                    {m.models.statuses[row.status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatHair(
  row: Pick<ModelsTableRow, "hairColor" | "hairShape" | "hairType">,
  msg: typeof m,
): string {
  const color =
    msg.models.hairColors[
      row.hairColor as keyof typeof msg.models.hairColors
    ] ?? row.hairColor;
  const shape =
    msg.models.hairShapes[
      row.hairShape as keyof typeof msg.models.hairShapes
    ] ?? row.hairShape;
  const type =
    msg.models.hairTypes[row.hairType as keyof typeof msg.models.hairTypes] ??
    row.hairType;
  const parts = [color, type, shape].filter((p) => p && p.length > 0);
  return parts.join(" · ") || "—";
}
