import { Link } from 'react-router-dom';

// material-ui
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import { APP_DEFAULT_PATH } from 'config';

// assets
import construction from 'assets/images/maintenance/under-construction.svg';

// ==============================|| UNDER CONSTRUCTION - MAIN ||============================== //

export default function UnderConstruction() {
  return (
    <Grid container spacing={4} sx={{ minHeight: '100vh', py: 2, alignItems: 'center', justifyContent: 'center' }}>
      <Grid size={12}>
        <Stack sx={{ gap: 2, alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: { xs: 300, sm: 480 }, my: 2 }}>
            <CardMedia component="img" src={construction} alt="mantis" sx={{ height: 'auto' }} />
          </Box>
          <Typography align="center" variant="h1">
            Under Construction
          </Typography>
          <Typography color="text.secondary" align="center" sx={{ width: '85%' }}>
            Hey! Please check out this site later. We are doing some maintenance on it right now.
          </Typography>
          <Button component={Link} to={APP_DEFAULT_PATH} variant="contained">
            Back To Home
          </Button>
        </Stack>
      </Grid>
    </Grid>
  );
}
