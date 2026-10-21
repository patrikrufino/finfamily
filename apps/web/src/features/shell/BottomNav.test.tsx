import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "../../test/render";
import { BottomNav } from "./BottomNav";

const renderNav = (path = "/") =>
  renderWithProviders(
    <>
      <BottomNav />
      <Routes>
        <Route path="*" element={<p>content</p>} />
      </Routes>
    </>,
    undefined,
    path,
  );

describe("BottomNav", () => {
  it("lists the five destinations in order, each with an icon and a visible label", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Início", "Lançamentos", "Orçamento", "Cartões", "Dívidas"]);
    for (const link of links) {
      expect(link.querySelector("svg")).not.toBeNull();
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("marks only the current destination", () => {
    renderNav("/cards");
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const current = within(nav).getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.map((l) => l.textContent)).toEqual(["Cartões"]);
  });

  it("keeps a destination current on its nested screens", () => {
    renderNav("/cards/3");
    expect(screen.getByRole("link", { name: "Cartões" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("only marks Início on the home route", () => {
    renderNav("/transactions");
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("navigates when a destination is tapped", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("link", { name: "Dívidas" }));
    expect(screen.getByRole("link", { name: "Dívidas" })).toHaveAttribute("aria-current", "page");
  });
});
