import PropTypes from 'prop-types';
// material-ui
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import CardMedia from '@mui/material/CardMedia';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// third-party
import { motion } from 'framer-motion';

// project imports
import SectionTypeset from './SectionTypeset';
import AnimateButton from 'components/@extended/AnimateButton';
import ContainerWrapper from 'components/ContainerWrapper';

import useConfig from 'hooks/useConfig';
import { ThemeDirection } from 'config';
import { getImageUrl, ImagePath } from 'utils/getImageUrl';

// assets
import DiscordFilled from '@ant-design/icons/DiscordFilled';
import DribbbleSquareFilled from '@ant-design/icons/DribbbleSquareFilled';
import GithubFilled from '@ant-design/icons/GithubFilled';
import FacebookFilled from '@ant-design/icons/FacebookFilled';
import InstagramFilled from '@ant-design/icons/InstagramFilled';
import LinkedinFilled from '@ant-design/icons/LinkedinFilled';
import YoutubeFilled from '@ant-design/icons/YoutubeFilled';
import XOutlined from '@ant-design/icons/XOutlined';

import imgfooterlogo from 'assets/images/landing/codedthemes-logo.svg';
import figma from 'assets/images/icons/figma.svg';

// link - custom style
const FooterLink = styled(Link)(({ theme }) => ({
  color: theme.vars.palette.secondary[400],
  '&:hover': { color: theme.vars.palette.primary.main },
  '&:active': { color: theme.vars.palette.primary.main }
}));

// ==============================|| LANDING - FOOTER PAGE ||============================== //

export default function Footer({ isFull }) {
  const { state } = useConfig();

  const linkSX = {
    color: 'common.white',
    fontSize: '1.1rem',
    fontWeight: 400,
    opacity: '0.6',
    cursor: 'pointer',
    '&:hover': {
      opacity: '1'
    }
  };

  const frameworks = [
    { title: 'Pro Figma UI Kit', link: 'https://codedthemes.com/item/mantis-figma-ui-kit/' },
    { title: 'CodeIgniter', link: 'https://codedthemes.com/item/mantis-codeigniter-admin-template/' },
    {
      title: 'Vue',
      link: 'https://codedthemes.com/item/mantis-vue-admin-template/'
    },
    {
      title: 'Angular',
      link: 'https://codedthemes.com/item/mantis-angular-admin-template/'
    },
    {
      title: 'Bootstrap 5',
      link: 'https://codedthemes.com/item/mantis-bootstrap-admin-dashboard/'
    },
    {
      title: '.Net',
      link: 'https://codedthemes.com/item/mantis-dotnet-bootstrap-dashboard-template/'
    }
  ];

  return (
    <>
      {isFull && (
        <Box
          sx={(theme) => ({
            position: 'relative',
            bgcolor: 'grey.A700',
            zIndex: 1,
            mt: { xs: 0, md: 13.75 },
            pt: { xs: 8, sm: 7.5, md: 18.75 },
            pb: { xs: 2.5, md: 10 },
            '&:after': {
              content: '""',
              position: 'absolute',
              width: '100%',
              height: '80%',
              bottom: 0,
              left: 0,
              background:
                theme.direction === ThemeDirection.RTL
                  ? `linear-gradient(transparent 100%, rgb(31, 31, 31) 70%)`
                  : `linear-gradient(180deg, transparent 0%, ${theme.vars.palette.grey.A700} 70%)`
            }
          })}
        >
          <CardMedia
            component="img"
            image={getImageUrl(`img-footer-${state.presetColor}.png`, ImagePath.LANDING)}
            alt="Mantis"
            sx={(theme) => ({
              display: { xs: 'none', md: 'block' },
              width: '55%',
              maxWidth: 700,
              position: 'absolute',
              top: '-28%',
              right: 0,
              ...(theme.direction === ThemeDirection.RTL && { transform: 'scaleX(-1)', float: 'none' })
            })}
          />
          <ContainerWrapper>
            <Grid container spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Grid sx={{ position: 'relative', zIndex: 1 }} size={{ xs: 12, md: 6 }}>
                <Grid container spacing={2} sx={(theme) => ({ [theme.breakpoints.down('md')]: { pr: 0, textAlign: 'center' } })}>
                  <Grid size={12}>
                    <SectionTypeset
                      caption="Help & Support"
                      heading="Help is just a click away"
                      description="Get answers fast. Our responsive support ensures you never face challenges alone."
                      stackProps={{ sx: { textAlign: 'left', justifyContent: 'flex-start' } }}
                      headingProps={{ sx: { color: 'common.white' } }}
                      descriptionProps={{ sx: { color: 'secondary.400' } }}
                    />
                  </Grid>
                  <Grid sx={{ my: 2 }} size={12}>
                    <Box sx={{ display: 'inline-block' }}>
                      <AnimateButton>
                        <Button
                          size="large"
                          variant="contained"
                          component={Link}
                          href="https://codedthemes.support-hub.io/"
                          target="_blank"
                        >
                          Create Ticket
                        </Button>
                      </AnimateButton>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </ContainerWrapper>
        </Box>
      )}
      <Box sx={{ mt: isFull ? 0 : 10, pt: isFull ? 0 : 10, pb: 10, bgcolor: 'grey.A700' }}>
        <ContainerWrapper>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, translateY: 280 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 150,
                  damping: 30
                }}
              >
                <Grid container spacing={2}>
                  <Grid size={12}>
                    <CardMedia component="img" image={imgfooterlogo} alt="CodedThemes" sx={{ width: 'auto' }} />
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 400, color: 'common.white' }}>
                      Since 2017, More than 400K+ developers trust the CodedThemes digital product. Mantis React is manage under our
                      experienced team players.
                    </Typography>
                  </Grid>
                </Grid>
              </motion.div>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={{ xs: 5, md: 2 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack sx={{ gap: { xs: 3, md: 5 } }}>
                    <Typography
                      variant="h5"
                      sx={(theme) => ({
                        fontWeight: 500,
                        color: 'background.paper',
                        ...theme.applyStyles('dark', { color: 'text.primary' })
                      })}
                    >
                      Help
                    </Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="https://blog.codedthemes.com/" target="_blank" underline="none">
                        Blog
                      </FooterLink>
                      <FooterLink href="https://codedthemes.gitbook.io/mantis/" target="_blank" underline="none">
                        Documentation
                      </FooterLink>
                      <FooterLink href="https://codedthemes.gitbook.io/mantis/changelog" target="_blank" underline="none">
                        Change Log
                      </FooterLink>
                      <FooterLink href="https://codedthemes.support-hub.io/" target="_blank" underline="none">
                        Support
                      </FooterLink>
                      <FooterLink href="https://discord.com/invite/p2E2WhCb6s" target="_blank" underline="none">
                        Discord
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack sx={{ gap: { xs: 3, md: 5 } }}>
                    <Typography
                      variant="h5"
                      sx={(theme) => ({
                        fontWeight: 500,
                        color: 'background.paper',
                        ...theme.applyStyles('dark', { color: 'text.primary' })
                      })}
                    >
                      Store Help
                    </Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="https://mui.com/store/license/" target="_blank" underline="none">
                        License
                      </FooterLink>
                      <FooterLink href="https://mui.com/store/customer-refund-policy/" target="_blank" underline="none">
                        Refund Policy
                      </FooterLink>
                      <FooterLink
                        href="https://support.mui.com/hc/en-us/sections/360002564979-For-customers"
                        target="_blank"
                        underline="none"
                      >
                        Submit a Request
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack sx={{ gap: { xs: 3, md: 5 } }}>
                    <Typography
                      variant="h5"
                      sx={(theme) => ({
                        fontWeight: 500,
                        color: 'background.paper',
                        ...theme.applyStyles('dark', { color: 'text.primary' })
                      })}
                    >
                      Mantis Eco-System
                    </Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      {frameworks.map((item, index) => (
                        <FooterLink href={item.link} target="_blank" underline="none" key={index}>
                          {item.title}
                          {/* {item.isUpcoming && <Chip variant="outlined" size="small" label="Upcoming" sx={{ ml: 0.5 }} />} */}
                        </FooterLink>
                      ))}
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack sx={{ gap: { xs: 3, md: 5 } }}>
                    <Typography
                      variant="h5"
                      sx={(theme) => ({
                        fontWeight: 500,
                        color: 'background.paper',
                        ...theme.applyStyles('dark', { color: 'text.primary' })
                      })}
                    >
                      More Products
                    </Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink
                        href="https://www.figma.com/community/file/1527646378189493961/mantis-free-dashboard-kit"
                        target="_blank"
                        underline="none"
                      >
                        Free Mantis Figma UI Kit
                      </FooterLink>
                      <FooterLink href="https://mui.com/store/previews/berry-react-material-admin/" target="_blank" underline="none">
                        Berry React Material
                      </FooterLink>
                      <FooterLink href="https://github.com/codedthemes/berry-free-react-admin-template" target="_blank" underline="none">
                        Free Berry React
                      </FooterLink>
                      <FooterLink href="https://github.com/codedthemes/mantis-free-react-admin-template" target="_blank" underline="none">
                        Free Mantis React
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </ContainerWrapper>
      </Box>
      <Divider sx={(theme) => ({ borderColor: 'grey.600', ...theme.applyStyles('dark', { borderColor: 'grey.200' }) })} />
      <Box
        sx={(theme) => ({
          py: 1.5,
          ...(isFull && { pb: { xs: 7.5, sm: 1.5 } }),
          bgcolor: 'grey.800',
          ...theme.applyStyles('dark', { bgcolor: 'grey.50' })
        })}
      >
        <ContainerWrapper>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" color="secondary" sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
              © Made with love by Team{' '}
              <Link href="https://codedthemes.com/" target="_blank" underline="hover">
                CodedThemes
              </Link>
            </Typography>
            <Stack
              direction="row"
              sx={{ gap: { xs: 2.25, md: 3 }, justifyContent: { xs: 'center', sm: 'flex-end' }, alignItems: 'center' }}
            >
              <Link href="https://github.com/codedthemes" underline="none" target="_blank" sx={linkSX}>
                <GithubFilled />
              </Link>
              <Link href="https://www.instagram.com/codedthemes" underline="none" target="_blank" sx={linkSX}>
                <InstagramFilled />
              </Link>
              <Link href="https://discord.com/invite/p2E2WhCb6s" underline="none" target="_blank" sx={linkSX}>
                <DiscordFilled />
              </Link>
              <Link href="https://www.youtube.com/channel/UCiZG__BaRkT1OuZl5ifzO6A" underline="none" target="_blank" sx={linkSX}>
                <YoutubeFilled />
              </Link>
              <Link href="https://x.com/codedthemes/" underline="none" target="_blank" sx={linkSX}>
                <XOutlined />
              </Link>
              <Link href="https://www.linkedin.com/company/codedthemes" underline="none" target="_blank" sx={linkSX}>
                <LinkedinFilled />
              </Link>
              <Link href="https://www.facebook.com/codedthemes/" underline="none" target="_blank" sx={linkSX}>
                <FacebookFilled />
              </Link>
              <Link href="https://dribbble.com/codedthemes" underline="none" target="_blank" sx={linkSX}>
                <DribbbleSquareFilled />
              </Link>
              <Link href="https://www.figma.com/@codedthemes" underline="none" target="_blank" sx={linkSX}>
                <Box
                  sx={(theme) => ({
                    p: 0.05,
                    borderRadius: '1px',
                    width: 16,
                    bgcolor: 'secondary.light',
                    ...theme.applyStyles('dark', { bgcolor: 'secondary.dark' })
                  })}
                >
                  <CardMedia src={figma} component="img" alt="Figma" />
                </Box>
              </Link>
            </Stack>
          </Stack>
        </ContainerWrapper>
      </Box>
    </>
  );
}

Footer.propTypes = { isFull: PropTypes.bool };
