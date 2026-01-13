import { createBrowserRouter } from "react-router-dom";
import Layout from "@/components/layout/Layout";

import Dashboard from "@/pages/Dashboard";
import NewDepense from "@/pages/NewDepense";
import NewRecette from "@/pages/NewRecette";
import NewTransfert from "@/pages/NewTransfert";
import Operations from "@/pages/Operations";
import Budgets from "@/pages/Budgets";
import Rapports from "@/pages/Rapports";
import ComptesInternes from "@/pages/ComptesInternes";
import CompteInterneDetails from "@/pages/CompteInterneDetails";
import ComptesExternes from "@/pages/ComptesExternes";
import CompteExterneDetails from "@/pages/CompteExterneDetails";
import ComptesTechniques from "@/pages/ComptesTechniques";
import ReferencesBanques from "@/pages/ReferencesBanques";
import BanqueDetails from "@/pages/BanqueDetails";
import ReferencesCategories from "@/pages/ReferencesCategories";
import ReferencesSousCategories from "@/pages/ReferencesSousCategories";
import ReferencesBeneficiaires from "@/pages/ReferencesBeneficiaires";
import ReferencesTitulaires from "@/pages/ReferencesTitulaires";
import TitulaireDetails from "@/pages/TitulaireDetails";
import Evaluations from "@/pages/Evaluations";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "depense", element: <NewDepense /> },
      { path: "recette", element: <NewRecette /> },
      { path: "transfert", element: <NewTransfert /> },
      { path: "operations", element: <Operations /> },
      { path: "budgets", element: <Budgets /> },
      { path: "rapports", element: <Rapports /> },
      { path: "comptes-internes", element: <ComptesInternes /> },
      { path: "comptes-internes/:identifiant", element: <CompteInterneDetails /> },
      { path: "comptes-externes", element: <ComptesExternes /> },
      { path: "comptes-externes/:identifiant", element: <CompteExterneDetails /> },
      { path: "comptes-techniques", element: <ComptesTechniques /> },
      { path: "banques", element: <ReferencesBanques /> },
      { path: "banques/:nom", element: <BanqueDetails /> },
      { path: "categories", element: <ReferencesCategories /> },
      { path: "sous-categories", element: <ReferencesSousCategories /> },
      { path: "beneficiaires", element: <ReferencesBeneficiaires /> },
      { path: "titulaires", element: <ReferencesTitulaires /> },
      { path: "titulaires/:nom", element: <TitulaireDetails /> },
      { path: "evaluations", element: <Evaluations /> },
      { path: "admin", element: <Admin /> },
      { path: "*", element: <NotFound /> }
    ]
  }
]);
