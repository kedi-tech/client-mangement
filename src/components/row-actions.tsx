import { ConfirmForm } from "@/components/confirm-form";
import { LinkButton } from "@/components/ui";

const small = "px-2 py-[3px] text-[12px]";

/**
 * View / Edit / Delete buttons at the end of a list row. Delete always asks
 * for confirmation first.
 */
export function RowActions({
  viewHref,
  editHref,
  remove,
}: {
  viewHref?: string;
  editHref?: string;
  remove?: {
    action: (formData: FormData) => Promise<void>;
    hidden: Record<string, string>;
    confirmMessage: string;
  };
}) {
  return (
    <span className="flex items-center justify-end gap-1.5">
      {viewHref ? (
        <LinkButton href={viewHref} variant="secondary" size="sm" className={small}>
          View
        </LinkButton>
      ) : null}
      {editHref ? (
        <LinkButton href={editHref} variant="secondary" size="sm" className={small}>
          Edit
        </LinkButton>
      ) : null}
      {remove ? (
        <ConfirmForm
          action={remove.action}
          hidden={remove.hidden}
          confirmMessage={remove.confirmMessage}
          className="flex"
          buttonTextClass={small}
        >
          Delete
        </ConfirmForm>
      ) : null}
    </span>
  );
}
