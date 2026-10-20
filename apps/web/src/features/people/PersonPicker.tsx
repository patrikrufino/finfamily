import { SegmentGroup } from "@ark-ui/react/segment-group";
import { useTranslation } from "react-i18next";
import { css } from "../../../styled-system/css";
import { type PersonKey, usePersonViewModel } from "./usePersonViewModel";

export function PersonPicker() {
  const { t } = useTranslation();
  const { person, people, setPerson } = usePersonViewModel();

  return (
    <SegmentGroup.Root
      value={person}
      onValueChange={(e) => e.value && setPerson(e.value as PersonKey)}
      aria-label={t("people.label")}
      className={css({
        display: "inline-flex",
        position: "relative",
        background: "border",
        borderRadius: "full",
        padding: "0.5",
      })}
    >
      <SegmentGroup.Indicator
        className={css({
          background: "primary",
          borderRadius: "full",
          width: "var(--width)",
          height: "var(--height)",
          top: "var(--top)",
          left: "var(--left)",
          position: "absolute",
          transition: "all 0.15s",
        })}
      />
      {people.map((key) => (
        <SegmentGroup.Item
          key={key}
          value={key}
          className={css({
            position: "relative",
            zIndex: 1,
            paddingInline: "3",
            paddingBlock: "1",
            fontSize: "sm",
            cursor: "pointer",
            color: "muted",
            "&[data-state=checked]": { color: "onPrimary" },
          })}
        >
          <SegmentGroup.ItemText>{t(`people.${key}`)}</SegmentGroup.ItemText>
          <SegmentGroup.ItemControl />
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
      ))}
    </SegmentGroup.Root>
  );
}
