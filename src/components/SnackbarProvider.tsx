import { SnackbarProvider as NotistackProvider } from "notistack";
import { type ReactNode } from "react";

export default function SnackbarProvider({ children }: { children: ReactNode }) {
  return (
    <NotistackProvider
      maxSnack={3}
      autoHideDuration={3000}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      variant="success"
    >
      {children}
    </NotistackProvider>
  );
}
