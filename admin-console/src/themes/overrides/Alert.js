// project imports
import { withAlpha } from 'utils/colorUtils';
import getColors from 'utils/getColors';

// ==============================|| ALERT - COLORS ||============================== //

function getColorStyle({ color, theme }) {
  const colors = getColors(theme, color);
  const { lighter, light, main } = colors;

  return {
    borderColor: withAlpha(light, 0.5),
    backgroundColor: lighter,
    '& .MuiAlert-icon': { color: main }
  };
}

// ==============================|| OVERRIDES - ALERT ||============================== //

export default function Alert(theme) {
  const primaryDashed = getColorStyle({ color: 'primary', theme });

  return {
    MuiAlert: {
      styleOverrides: {
        root: {
          color: theme.vars.palette.text.primary,
          fontSize: '0.875rem',
          variants: [
            {
              props: { variant: 'standard' },
              style: ({ ownerState }) => {
                const paletteColor = theme.palette[ownerState.color];
                return {
                  position: 'relative',
                  backgroundColor: paletteColor.lighter,
                  '& .MuiAlert-icon': {
                    color: paletteColor.main
                  },
                  ...theme.applyStyles('dark', {
                    backgroundColor: withAlpha(theme.vars.palette.background.default, 0.99),
                    '&:before': {
                      width: '100%',
                      height: '100%',
                      position: 'absolute',
                      content: '""',
                      backgroundColor: paletteColor.main,
                      top: 0,
                      left: 0,
                      opacity: 0.05
                    }
                  })
                };
              }
            },
            {
              props: { variant: 'filled' },
              style: ({ ownerState }) => {
                const paletteColor = theme.palette[ownerState.color];
                return {
                  color: theme.vars.palette.grey[0],
                  backgroundColor: paletteColor.main,
                  ...theme.applyStyles('dark', {
                    backgroundColor: paletteColor.dark,
                    ...(ownerState.color === 'secondary' && { backgroundColor: paletteColor.main })
                  })
                };
              }
            }
          ]
        },
        icon: {
          fontSize: '1rem'
        },
        message: {
          padding: 0,
          marginTop: 3
        },
        border: {
          padding: '10px 16px',
          border: '1px solid',
          ...primaryDashed,
          '&.MuiAlert-borderPrimary': getColorStyle({ color: 'primary', theme }),
          '&.MuiAlert-borderSecondary': getColorStyle({ color: 'secondary', theme }),
          '&.MuiAlert-borderError': getColorStyle({ color: 'error', theme }),
          '&.MuiAlert-borderSuccess': getColorStyle({ color: 'success', theme }),
          '&.MuiAlert-borderInfo': getColorStyle({ color: 'info', theme }),
          '&.MuiAlert-borderWarning': getColorStyle({ color: 'warning', theme })
        },
        action: {
          '& .MuiButton-root': {
            padding: 2,
            height: 'auto',
            fontSize: '0.75rem',
            marginTop: -2
          },
          '& .MuiIconButton-root': {
            width: 'auto',
            height: 'auto',
            padding: 2,
            marginRight: 6,
            '& .MuiSvgIcon-root': {
              fontSize: '1rem'
            }
          }
        }
      }
    }
  };
}
