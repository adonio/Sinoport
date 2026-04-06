// ==============================|| OVERRIDES - CHART AXIS HIGHLIGHT ||============================== //

export default function ChartsAxiasHighlight(theme) {
  return {
    MuiChartsAxisHighlight: {
      styleOverrides: {
        root: {
          '&&': {
            stroke: theme.vars.palette.secondary.light,
            strokeDasharray: '4 4',
            strokeWidth: 1
          },
          ':where([data-color-scheme="light"]) &, :where([data-color-scheme="dark"]) &': {
            stroke: theme.vars.palette.secondary.light
          }
        }
      }
    }
  };
}
