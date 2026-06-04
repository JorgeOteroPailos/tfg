interface ThemeColors {
  text: string;
  title: string;
  background: string;
  navBackground: string;
  uiBackground: string;
  iconColor: string;
  iconColorFocused: string;
  tabBackground: string;
  tabIconDefault: string;
  tint: string;
  border: string;
  icon: string;
}

interface ColorsType {
  primary: string;
  warning: string;
  secondary: string;
  dark: ThemeColors;
  light: ThemeColors;
}

export const Colors: ColorsType = {
  primary: "#9d44f0",
  warning: "#ef4444",
  secondary: "#f59e0b",

  dark: {
    text: "#e8e0fa",
    title: "#ffffff",
    background: "#07050f",
    navBackground: "#040311",
    uiBackground: "#0e0b1f",
    iconColor: "#a890d8",
    iconColorFocused: "#ffffff",
    tabBackground: "#0b0919",
    tabIconDefault: "#a890d8",
    tint: "#a855f7",
    border: "#2b1650",
    icon: "#a890d8",
  },

  light: {
    text: "#3d1e7a",
    title: "#14043a",
    background: "#f7f3ff",
    navBackground: "#ffffff",
    uiBackground: "#ede3fd",
    iconColor: "#9472cc",
    iconColorFocused: "#14043a",
    tabBackground: "#fefcff",
    tabIconDefault: "#9472cc",
    tint: "#7c3aed",
    border: "#d4c2f9",
    icon: "#9472cc",
  },
};
