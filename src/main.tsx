import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "./styles.css";
import { getRouter } from "./router";
import { bootstrap } from "./auth/store";

const router = getRouter();
declare module "@tanstack/react-router" { interface Register { router: typeof router } }

void bootstrap(); // rehydrate the session from the refresh cookie before routes render their guards
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
