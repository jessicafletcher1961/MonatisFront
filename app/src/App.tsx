import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Budgets } from "./pages/Budgets";
import { NotFound } from "./pages/NotFound";
import { Rapports } from "./pages/Rapports";
import { Admin } from "./pages/Admin";
import { References } from "./pages/References";
import { EvaluationsLayout } from "./pages/evaluations/EvaluationsLayout";
import { EvaluationsEmpty } from "./pages/evaluations/EvaluationsEmpty";
import { EvaluationDetail } from "./pages/evaluations/EvaluationDetail";
import { TitulairesLayout } from "./pages/titulaires/TitulairesLayout";
import { TitulairesEmpty } from "./pages/titulaires/TitulairesEmpty";
import { TitulaireDetail } from "./pages/titulaires/TitulaireDetail";
import { ComptesLayout } from "./pages/comptes/ComptesLayout";
import { ComptesEmpty } from "./pages/comptes/ComptesEmpty";
import { CompteDetail } from "./pages/comptes/CompteDetail";
import { ComptesManage } from "./pages/comptes/ComptesManage";
import { OperationsLayout } from "./pages/operations/OperationsLayout";
import { OperationsEmpty } from "./pages/operations/OperationsEmpty";
import { OperationCreate } from "./pages/operations/OperationCreate";
import { OperationSpecialCreate } from "./pages/operations/OperationSpecialCreate";
import { OperationDetail } from "./pages/operations/OperationDetail";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="references" element={<References />} />
          <Route path="references/titulaires" element={<TitulairesLayout />}>
            <Route index element={<TitulairesEmpty />} />
            <Route path=":nom" element={<TitulaireDetail />} />
          </Route>
          <Route path="comptes/interne" element={<ComptesLayout />}>
            <Route index element={<ComptesEmpty />} />
            <Route path=":identifiant" element={<CompteDetail />} />
          </Route>
          <Route path="comptes/manage" element={<ComptesManage />} />
          <Route path="operations" element={<OperationsLayout />}>
            <Route index element={<OperationsEmpty />} />
            <Route path="new" element={<OperationCreate />} />
            <Route path="special" element={<OperationSpecialCreate />} />
            <Route path=":numero" element={<OperationDetail />} />
          </Route>
          <Route path="evaluations" element={<EvaluationsLayout />}>
            <Route index element={<EvaluationsEmpty />} />
            <Route path=":cle" element={<EvaluationDetail />} />
          </Route>
          <Route path="budgets" element={<Budgets />} />
          <Route path="rapports" element={<Rapports />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
