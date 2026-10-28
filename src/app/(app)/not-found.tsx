import { LinkButton } from "@/components/ui";

/** 404 inside the admin shell, for records that do not exist or were deleted. */
export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-start gap-3 px-4 py-20">
      <span className="font-mono text-[13px] text-fa">404</span>
      <h1 className="m-0 text-[24px] font-semibold">Page not found</h1>
      <p className="m-0 text-[14px] leading-[1.55] text-mu">
        The record you are looking for may have been deleted, or the link is wrong.
      </p>
      <LinkButton href="/dashboard" size="lg">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
