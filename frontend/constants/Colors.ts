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
  dark: ThemeColors;
  light: ThemeColors;
}

export const Colors: ColorsType = {
  primary: "#8b3ce0",
  warning: "#dc2626",

  dark: {
    text: "#e8e0fa",
    title: "#ffffff",
    background: "#07050f",
    navBackground: "#040311",
    uiBackground: "#0e0b1f",
    iconColor: "#a890d8",
    iconColorFocused: "#ffffff",
    tabBackground: "#160f2b",
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
    iconColor: "#67509c",
    iconColorFocused: "#14043a",
    tabBackground: "#fefcff",
    tabIconDefault: "#67509c",
    tint: "#7c3aed",
    border: "#d4c2f9",
    icon: "#67509c",
  },
};
