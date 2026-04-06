import { Link } from 'react-router-dom';

// material-ui
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import { APP_DEFAULT_PATH } from 'config';

// assets
import error404 from 'assets/images/maintenance/Error404.png';
import TwoCone from 'assets/images/maintenance/TwoCone.png';

// ==============================|| ERROR 404 - MAIN ||============================== //

export default function Error404() {
  return (
    <Stack sx={{ gap: 10, minHeight: '100vh', pt: 1.5, pb: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <Stack direction="row" sx={{ justifyContent: 'center' }}>
        <Box sx={{ width: { xs: 250, sm: 590 }, height: { xs: 130, sm: 300 } }}>
          <CardMedia component="img" sx={{ height: 1 }} src={error404} alt="mantis" />
        </Box>
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 60, left: -40, width: { xs: 130, sm: 390 }, height: { xs: 115, sm: 330 } }}>
            <CardMedia component="img" src={TwoCone} alt="mantis" sx={{ height: 1 }} />
          </Box>
        </Box>
      </Stack>
      <Stack sx={{ gap: 2, alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h1">Page Not Found</Typography>
        <Typography color="text.secondary" align="center" sx={{ width: { xs: '73%', sm: '61%' } }}>
          The page you are looking was moved, removed, renamed, or might never exist!
        </Typography>
        <Button component={Link} to={APP_DEFAULT_PATH} variant="contained">
          Back To Home
        </Button>
      </Stack>
    </Stack>
  );
}
