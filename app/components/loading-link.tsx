"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";
import { LoadingLogo } from "./loading-logo";

function NavigationLoading() {
  const { pending } = useLinkStatus();
  // Prefetched, instant navigations skip the pending state.
  return pending ? createPortal(<LoadingLogo variant="overlay" label="Cambiando de pantalla" />, document.body) : null;
}

export function LoadingLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<NavigationLoading /></Link>;
}
