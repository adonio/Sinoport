import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';

import sinoportLogo from 'assets/images/sinoport-logo.png';

export default function LogoMain({ reverse }) {
  const theme = useTheme();

  return (
    <Box
      component="img"
      src={sinoportLogo}
      alt="Sinoport"
      sx={{
        display: 'block',
        width: 168,
        height: 'auto',
        maxWidth: '100%',
        borderRadius: 1,
        ...(reverse && {
          bgcolor: alpha(theme.vars.palette.common.white, 0.08),
          p: 0.5
        })
      }}
    />
  );
}

LogoMain.propTypes = { reverse: PropTypes.bool };
