// ==============================|| OVERRIDES - DIALOG CONTENT TEXT ||============================== //

export default function Popover(theme) {
  return {
    MuiPopover: {
      styleOverrides: {
        paper: {
          boxShadow: theme.vars.customShadows.z1
        }
      }
    }
  };
}
