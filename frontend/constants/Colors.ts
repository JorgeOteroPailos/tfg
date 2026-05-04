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
}

interface ColorsType {
  primary: string;
  warning: string;
  secondary: string;
  dark: ThemeColors;
  light: ThemeColors;
}

export const Colors: ColorsType = {
  primary: "#6849a7",
  warning: "#cc475a",
  secondary: "#EA8A00",

  dark: {
    text: "#d4d4d4",
    title: "#fff",
    background: "#252231",
    navBackground: "#201e2b",
    uibackground: "#2f2b3d",
    iconColor: "#9591a5",
    iconColorFocused: "#fff",
    tabBackground: "#2f2b3d",
    tabIconDefault: "#9591a5",
    tint: "#6849a7",
    border: "#3d3850",
  },

  light: {
    text: "#201e2b",
    title: "#201e2b",
    background: "#e0dfe8",
    navBackground: "#e8e7ef",
    uibackground: "#2f2b3d",
    iconColor: "#686477",
    iconColorFocused: "#201e2b",
    tabBackground: "#d6d5e1",
    tabIconDefault: "#686477",
    tint: "#6849a7",
    border: "#c9c8d4",
  },
};