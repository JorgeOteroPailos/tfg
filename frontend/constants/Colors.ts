interface ColorsType {
  primary: string;
  warning: string;
  secondary: string;
  dark: {
    text: string;
    title: string;
    background: string;
    navBackground: string;
    iconColor: string;
    iconColorFocused: string;
    uiBackground: string;
  };
  light: {
    text: string;
    title: string;
    background: string;
    navBackground: string;
    iconColor: string;
    iconColorFocused: string;
    uiBackground: string;
  };
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
    iconColor: "#9591a5",
    iconColorFocused: "#fff",
    uiBackground: "#2f2b3d",
  },

  light: {
    text: "#201e2b",
    title: "#201e2b",
    background: "#e0dfe8",
    navBackground: "#e8e7ef",
    iconColor: "#686477",
    iconColorFocused: "#201e2b",
    uiBackground: "#d6d5e1",
  },
};
