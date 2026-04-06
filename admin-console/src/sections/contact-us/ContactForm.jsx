import { useState } from 'react';

// material-ui
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// select project-budget
const currencies = [
  {
    value: '1',
    label: 'Below $1000'
  },
  {
    value: '2',
    label: '$1000 - $5000'
  },
  {
    value: '3',
    label: 'Not specified'
  }
];

// select company-size
const sizes = [
  {
    value: '1',
    label: '1 - 5'
  },
  {
    value: '2',
    label: '5 - 10'
  },
  {
    value: '3',
    label: '10+'
  }
];

// ==============================|| CONTACT US - FORM ||============================== //

export default function ContactForm() {
  const [budget, setBudget] = useState(1);
  const handleProjectBudget = (event) => {
    setBudget(Number(event.target?.value));
  };

  const [size, setSize] = useState(1);
  const handleCompanySize = (event) => {
    setSize(Number(event.target?.value));
  };

  return (
    <Grid container spacing={5} sx={{ justifyContent: 'center' }}>
      <Grid size={{ xs: 12, sm: 10, lg: 9 }}>
        <Stack sx={{ gap: 2, alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="primary">Get In touch</Typography>
          <Typography align="center" variant="h2">
            We’d love to hear from you!
          </Typography>
          <Typography variant="caption" align="center" color="text.secondary" sx={{ maxWidth: '355px' }}>
            The starting point for your next project based on easy-to-customize Material-UI © helps you build apps faster and better.
          </Typography>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, sm: 10, lg: 9 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="text" placeholder="Name" />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="text" placeholder="Company Name" />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="email" placeholder="Email Address" />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField fullWidth type="number" placeholder="Phone Number" />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth placeholder="Company Size" value={size} onChange={handleCompanySize}>
              {sizes.map((option, index) => (
                <MenuItem key={index} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField select fullWidth placeholder="Project Budget" value={budget} onChange={handleProjectBudget}>
              {currencies.map((option, index) => (
                <MenuItem key={index} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline rows={4} placeholder="Message" />
          </Grid>
        </Grid>
      </Grid>
      <Grid size={{ xs: 12, sm: 10, lg: 9 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 1, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack direction="row" sx={{ alignItems: 'center', ml: -1 }}>
            <Checkbox sx={{ '& .css-1vjb4cj': { borderRadius: '2px' } }} defaultChecked />
            <Typography>
              By submitting this, you agree to the{' '}
              <Typography
                component={Link}
                href="https://mui.com/legal/privacy/"
                target="_blank"
                sx={{ cursor: 'pointer' }}
                color="primary.main"
              >
                Privacy Policy
              </Typography>{' '}
              and{' '}
              <Typography
                component={Link}
                href="https://mui.com/store/terms/"
                target="_blank"
                sx={{ cursor: 'pointer' }}
                color="primary.main"
              >
                Terms and Conditions.
              </Typography>
            </Typography>
          </Stack>
          <Button variant="contained" sx={{ minWidth: 112, ml: { xs: 0 } }}>
            Submit Now
          </Button>
        </Stack>
      </Grid>
    </Grid>
  );
}
