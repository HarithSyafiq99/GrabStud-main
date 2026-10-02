"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComponentProps, useTransition } from "react";
import { BookingProgress } from "./BookingProgress";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  href: string;
};

export function LoadingLink({ href, replace, scroll, ...props }: Props) {
  const router = useRouter();
  const [pending, startNavigation] = useTransition();
  return (
    <>
      <Link
        {...props}
        href={href}
        replace={replace}
        scroll={scroll}
        onNavigate={(event) => {
          event.preventDefault();
          startNavigation(() => {
            if (replace) router.replace(href, { scroll });
            else router.push(href, { scroll });
          });
        }}
      />
      <BookingProgress active={pending} label="Opening your page…" />
    </>
  );
}
