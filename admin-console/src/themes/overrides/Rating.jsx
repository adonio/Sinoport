// assets
import StarFilled from '@ant-design/icons/StarFilled';
import StarOutlined from '@ant-design/icons/StarOutlined';

// ==============================|| OVERRIDES - RATING ||============================== //

export default function Rating(theme) {
  return {
    MuiRating: {
      defaultProps: {
        emptyIcon: <StarOutlined />,
        icon: <StarFilled />
      },
      styleOverrides: {
        root: {
          color: theme.vars.palette.warning.main
        },
        iconEmpty: {
          color: theme.vars.palette.secondary[200]
        },
        sizeSmall: {
          gap: 4,
          fontSize: 14
        },
        sizeMedium: {
          gap: 6,
          fontSize: 18
        },
        sizeLarge: {
          gap: 8,
          fontSize: 24
        }
      }
    }
  };
}
