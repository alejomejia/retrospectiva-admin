import type { ComponentProps } from "react";

import { PageHeaderBack } from "./page-header-back";
import { PageHeaderDescription } from "./page-header-description";
import { PageHeaderEyebrow } from "./page-header-eyebrow";
import { PageHeaderTitle } from "./page-header-title";
import { PageHeaderColumn } from "./page-header-column";

function PageHeaderRoot({ className, ...props }: ComponentProps<"header">) {
  return (
    <header className="flex gap-4 p-6 border-b border-border" {...props} />
  );
}

export const PageHeader = Object.assign(PageHeaderRoot, {
  Column: PageHeaderColumn,
  Back: PageHeaderBack,
  Eyebrow: PageHeaderEyebrow,
  Title: PageHeaderTitle,
  Description: PageHeaderDescription,
});
