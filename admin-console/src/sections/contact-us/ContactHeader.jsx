import useMediaQuery from '@mui/material/useMediaQuery';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import MainCard from 'components/MainCard';
import { ThemeDirection } from 'config';

// assets
import worldMap from 'assets/images/contact/worldMap.png';
import ContainerWrapper from 'components/ContainerWrapper';

// ==============================|| CONTACT US - HEADER ||============================== //

export default function ContactHeader() {
  const downSM = useMediaQuery((theme) => theme.breakpoints.down('sm'));

  return (
    <MainCard
      contentSX={{ px: 0 }}
      sx={(theme) => ({
        ...theme.mixins.toolbar,
        position: 'relative',
        bgcolor: 'grey.800',
        ...theme.applyStyles('dark', { bgcolor: 'grey.0' }),
        overflow: 'hidden',
        '&>*': {
          position: 'relative',
          zIndex: 5
        },
        '&:before': {
          content: '""',
          position: 'absolute',
          width: '100%',
          height: { xs: '100%', sm: 380, md: 480, lg: 550 },
          top: 0,
          left: 0,
          zIndex: 2,
          background:
            theme.direction === ThemeDirection.RTL
              ? {
                  xs: 'linear-gradient(-360.36deg, rgb(0, 0, 0) 14.79%, rgba(67, 67, 67, 0.28) 64.86%)',
                  md: 'linear-gradient(-329.36deg, rgb(0, 0, 0) 1.79%, rgba(67, 67, 67, 0.28) 64.86%)',
                  xl: 'linear-gradient(-329.36deg, rgb(0, 0, 0) 1.79%, rgba(67, 67, 67, 0.28) 64.86%)'
                }
              : 'linear-gradient(329.36deg, rgb(0, 0, 0) 14.79%, rgba(67, 67, 67, 0.28) 64.86%)'
        },
        border: 'transparent',
        borderRadius: 0,
        m: 0,
        height: { xs: '100%', sm: 380, md: 480, lg: 550 }
      })}
    >
      <ContainerWrapper>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: { xs: 0, sm: 3 }, alignItems: 'center', justifyContent: { xs: 'space-around', md: 'space-between' } }}
        >
          <Box sx={{ width: { xs: '100%', sm: 252, md: 360, lg: 436 }, pt: 6 }}>
            <Stack sx={{ gap: 1 }}>
              <Typography
                variant="h2"
                sx={(theme) => ({
                  color: 'secondary.lighter',
                  textAlign: downSM ? 'center' : 'left',
                  ...theme.applyStyles('dark', { color: 'text.primary' })
                })}
              >
                Talk to our{' '}
                <Typography variant="h2" component="span" color="primary" sx={{ cursor: 'pointer' }}>
                  Expert
                </Typography>
              </Typography>
              <Typography color="text.secondary" sx={{ textAlign: downSM ? 'center' : 'left' }}>
                If you need any help or have questions, just reach out to us—we’re always here to support you.
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ width: { xs: 350, md: 480, lg: 550 } }}>
            <CardMedia component="img" src={worldMap} alt="mantis" />
          </Box>
        </Stack>
      </ContainerWrapper>
    </MainCard>
  );
}
