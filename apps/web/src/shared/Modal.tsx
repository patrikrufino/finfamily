import { Dialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} lazyMount unmountOnExit>
      <Portal>
        <Dialog.Backdrop className={css({ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10 })} />
        <Dialog.Positioner
          className={css({ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 11 })}
        >
          <Dialog.Content
            className={css({
              width: "100%",
              maxWidth: "lg",
              maxHeight: "92dvh",
              overflowY: "auto",
              background: "bg",
              color: "text",
              borderTopLeftRadius: "xl",
              borderTopRightRadius: "xl",
              padding: "4",
              paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
            })}
          >
            <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4" })}>
              <Dialog.Title className={css({ fontSize: "lg", fontWeight: "bold" })}>{title}</Dialog.Title>
              <Dialog.CloseTrigger aria-label={t("common.close")} className={css({ fontSize: "xl", cursor: "pointer" })}>
                ×
              </Dialog.CloseTrigger>
            </div>
            {children}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
