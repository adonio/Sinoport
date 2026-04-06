import { Link, useSearchParams } from 'react-router-dom';

// material-ui
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import SupabaseRegister from 'sections/auth/supabase/AuthRegister';

// ================================|| SUPERBASE - REGISTER ||================================ //

export default function Register() {
  const { isLoggedIn } = useAuth();

  const [searchParams] = useSearchParams();
  const auth = searchParams.get('auth'); // get auth and set route based on that

  return (
    <AuthWrapper>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: { xs: -0.5, sm: 0.5 } }}>
            <Typography variant="h3">Sign up</Typography>
            <Typography
              component={Link}
              to={isLoggedIn ? '/auth/login' : auth ? `/${auth}/login?auth=supabase` : '/login'}
              variant="body1"
              sx={{ textDecoration: 'none' }}
              color="primary"
            >
              Already have an account?
            </Typography>
          </Stack>
        </Grid>
        <Grid size={12}>
          <SupabaseRegister />
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}
