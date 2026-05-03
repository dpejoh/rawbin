import { createTheme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface Palette {
    surface: Palette["primary"];
    surfaceContainer: Palette["primary"];
    surfaceContainerHigh: Palette["primary"];
    outline: Palette["primary"];
    outlineVariant: Palette["primary"];
  }
  interface PaletteOptions {
    surface?: PaletteOptions["primary"];
    surfaceContainer?: PaletteOptions["primary"];
    surfaceContainerHigh?: PaletteOptions["primary"];
    outline?: PaletteOptions["primary"];
    outlineVariant?: PaletteOptions["primary"];
  }
}

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#A8C7FA",
    },
    error: {
      main: "#FFB4AB",
    },
    success: {
      main: "#6DD58C",
    },
    surface: {
      main: "#111318",
    },
    surfaceContainer: {
      main: "#1E2128",
    },
    surfaceContainerHigh: {
      main: "#282C34",
    },
    outline: {
      main: "#8E9099",
    },
    outlineVariant: {
      main: "#44474F",
    },
    background: {
      default: "#111318",
      paper: "#1E2128",
    },
    text: {
      primary: "#E2E2E9",
      secondary: "#C5C6D0",
    },
  },
  typography: {
    fontFamily: '"Geist Mono", monospace',
    h4: {
      fontSize: "28px",
      fontWeight: 400,
      lineHeight: "36px",
    },
    h5: {
      fontSize: "24px",
      fontWeight: 400,
      lineHeight: "32px",
    },
    h6: {
      fontSize: "22px",
      fontWeight: 400,
      lineHeight: "28px",
    },
    subtitle1: {
      fontSize: "16px",
      fontWeight: 500,
      lineHeight: "24px",
    },
    subtitle2: {
      fontSize: "14px",
      fontWeight: 500,
      lineHeight: "20px",
    },
    body1: {
      fontSize: "16px",
      fontWeight: 400,
      lineHeight: "24px",
    },
    body2: {
      fontSize: "14px",
      fontWeight: 400,
      lineHeight: "20px",
    },
    caption: {
      fontSize: "12px",
      fontWeight: 400,
      lineHeight: "16px",
    },
    button: {
      fontFamily: '"Geist Mono", monospace',
      fontSize: "14px",
      fontWeight: 500,
      lineHeight: "20px",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: "8px",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiInputBase-input": {
            fontFamily: '"Geist Mono", monospace',
          },
        },
      },
    },
  },
});

export default theme;
