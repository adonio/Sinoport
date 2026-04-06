import Box from '@mui/material/Box';

import sinoportLogo from 'assets/images/sinoport-logo.png';

export default function LogoIcon() {
  return (
    <Box
      component="img"
      src={sinoportLogo}
      alt="Sinoport"
      sx={{
        width: 36,
        height: 36,
        display: 'block',
        objectFit: 'cover',
        objectPosition: 'left center',
        borderRadius: 1
      }}
    />
  );
}
