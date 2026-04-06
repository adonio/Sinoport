import useMediaQuery from '@mui/material/useMediaQuery';
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// third-party
import { useTimer } from 'react-timer-hook';

// project imports
import MainCard from 'components/MainCard';

// assets
import coming from 'assets/images/maintenance/coming-soon.png';

// ==============================|| COMING SOON - TIMER ||============================== //

const TimerBox = ({ count, label }) => {
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  return (
    <MainCard content={false} sx={{ width: { xs: 60, sm: 80 } }}>
      <Stack sx={{ alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ py: 1.75 }}>
          <Typography variant={downSM ? 'h4' : 'h2'}>{count}</Typography>
        </Box>
        <Box sx={{ p: 0.5, bgcolor: 'secondary.lighter', width: '100%' }}>
          <Typography align="center" variant="subtitle2">
            {label}
          </Typography>
        </Box>
      </Stack>
    </MainCard>
  );
};

// ==============================|| COMING SOON - MAIN ||============================== //

export default function ComingSoon() {
  const time = new Date();
  time.setSeconds(time.getSeconds() + 3600 * 24 * 2 - 3600 * 15.5);

  const { seconds, minutes, hours, days } = useTimer({ expiryTimestamp: time });

  return (
    <Stack sx={{ gap: 4, minHeight: '100vh', py: 2, alignItems: 'center', justifyContent: 'center' }}>
      <Stack sx={{ gap: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ height: { xs: 310, sm: 420 }, width: { xs: 360, sm: 'auto' }, my: 2 }}>
          <CardMedia component="img" src={coming} alt="mantis" sx={{ height: 1 }} />
        </Box>
        <Typography align="center" variant="h1">
          Coming Soon
        </Typography>
        <Typography align="center" color="text.secondary">
          Something new is on its way
        </Typography>
      </Stack>

      <Box sx={{ width: { xs: '95%', md: '40%' } }}>
        <Stack direction="row" sx={{ gap: { xs: 1, sm: 2 }, alignItems: 'center', justifyContent: 'center' }}>
          <TimerBox count={days} label="day" />
          <Typography variant="h1"> : </Typography>
          <TimerBox count={hours} label="hour" />
          <Typography variant="h1"> : </Typography>
          <TimerBox count={minutes} label="min" />
          <Typography variant="h1"> : </Typography>
          <TimerBox count={seconds} label="sec" />
        </Stack>
      </Box>
      <Box sx={{ width: { xs: 340, md: '40%', lg: '30%' } }}>
        <Stack sx={{ gap: 2, mt: 2 }}>
          <Typography align="center" color="text.secondary">
            Be the first to be notified when Mantis launches.
          </Typography>
          <Stack direction="row" sx={{ gap: 1 }}>
            <TextField fullWidth placeholder="Email Address" />
            <Button variant="contained" sx={{ width: '50%' }}>
              Notify Me
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}
