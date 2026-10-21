import { useTranslation } from "react-i18next";
import { css } from "../../styled-system/css";
import { Modal } from "./Modal";
import { dangerButton, secondaryButton } from "./ui";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Modal open onClose={onClose} title={title}>
      <div className={css({ display: "grid", gap: "3" })}>
        <p>{message}</p>
        <button type="button" className={dangerButton} onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" className={secondaryButton} onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </Modal>
  );
}
