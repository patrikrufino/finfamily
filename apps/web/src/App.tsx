import { useState } from "react";
import { Route, Routes } from "react-router";
import { useTranslation } from "react-i18next";
import { css } from "../styled-system/css";
import { BottomNav } from "./features/shell/BottomNav";
import { PersonPicker } from "./features/people/PersonPicker";
import { ThemeToggle } from "./features/theme/ThemeToggle";
import { TransactionDialog } from "./features/transactions/TransactionDialog";
import { BudgetPage } from "./pages/BudgetPage";
import { CardDetailPage } from "./pages/CardDetailPage";
import { CardsPage } from "./pages/CardsPage";
import { DebtDetailPage } from "./pages/DebtDetailPage";
import { DebtsPage } from "./pages/DebtsPage";
import { HomePage } from "./pages/HomePage";
import { InstallmentsPage } from "./pages/InstallmentsPage";
import { PlanDetailPage } from "./pages/PlanDetailPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { PlusIcon } from "./shared/icons";

export function App() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);

  return (
    <div className={css({ minHeight: "100dvh", background: "bg", color: "text", paddingBottom: "calc(168px + env(safe-area-inset-bottom))" })}>
      <header
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "2",
          padding: "4",
          flexWrap: "wrap",
        })}
      >
        <PersonPicker />
        <ThemeToggle />
      </header>

      <main className={css({ padding: "4" })}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/installments" element={<InstallmentsPage />} />
          <Route path="/installments/:id" element={<PlanDetailPage />} />
          <Route path="/debts" element={<DebtsPage />} />
          <Route path="/debts/:id" element={<DebtDetailPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:id" element={<CardDetailPage />} />
        </Routes>
      </main>

      {/* Sits 16px above the 64px bottom bar and the device safe area, so it never covers the navigation. */}
      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label={t("actions.newTransaction")}
        className={css({
          position: "fixed",
          right: "4",
          bottom: "calc(80px + env(safe-area-inset-bottom))",
          zIndex: 6,
          width: "14",
          height: "14",
          borderRadius: "full",
          background: "primary",
          color: "onPrimary",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "lg",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          "&:active": { transform: "scale(0.96)" },
        })}
      >
        <PlusIcon size={28} />
      </button>

      <TransactionDialog open={creating} onClose={() => setCreating(false)} />

      <BottomNav />
    </div>
  );
}
