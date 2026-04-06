import PropTypes from 'prop-types';
import * as React from 'react';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

// material-ui
import AppBar from '@mui/material/AppBar';
import useScrollTrigger from '@mui/material/useScrollTrigger';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import Logo from 'components/logo';
import ContainerWrapper from 'components/ContainerWrapper';
import IconButton from 'components/@extended/IconButton';
import AnimateButton from 'components/@extended/AnimateButton';

import useAuth from 'hooks/useAuth';
import { APP_DEFAULT_PATH } from 'config';

// assets
import GithubOutlined from '@ant-design/icons/GithubOutlined';
import MenuOutlined from '@ant-design/icons/MenuOutlined';
import LineOutlined from '@ant-design/icons/LineOutlined';

// ==============================|| ELEVATION SCROLL COMPONENT ||============================== //

function ElevationScroll({ children, window }) {
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 10,
    target: window ? window() : undefined
  });

  return React.cloneElement(children, {
    style: {
      ...(!trigger && { background: 'transparent' })
    }
  });
}

// ==============================|| COMMON HEADER COMPONENT ||============================== //

export default function Header({
  variant = 'simple',
  enableElevationScroll = false,
  enableComponentDrawer = false,
  onComponentDrawerToggle,
  isComponentDrawerOpened = false
}) {
  const { isLoggedIn } = useAuth();
  const [drawerToggle, setDrawerToggle] = useState(false);

  /** Method called on multiple components with different event types */
  const drawerToggler = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerToggle(open);
  };

  const handleComponentDrawerToggle = () => {
    if (enableComponentDrawer && onComponentDrawerToggle) {
      onComponentDrawerToggle(!isComponentDrawerOpened);
    } else {
      drawerToggler(true);
    }
  };

  const getDesktopLinks = () => {
    if (variant === 'component') {
      return (
        <Stack sx={{ '& .header-link': { px: 2, '&:hover': { color: 'primary.main' } }, display: { xs: 'none', md: 'block' } }}>
          <Link className="header-link" color="white" component={RouterLink} to="/login" target="_blank" underline="none">
            Dashboard
          </Link>
          <Link className="header-link" color="primary" component={RouterLink} to="/components-overview" underline="none">
            Components
          </Link>
          <Link className="header-link" color="white" href="https://codedthemes.gitbook.io/mantis/" target="_blank" underline="none">
            Documentation
          </Link>
          <Box sx={{ display: 'inline-block', ml: 1 }}>
            <AnimateButton>
              <Button
                component={Link}
                href="https://mui.com/store/items/mantis-react-admin-dashboard-template/"
                target="_blank"
                disableElevation
                color="primary"
                variant="contained"
              >
                Purchase Now
              </Button>
            </AnimateButton>
          </Box>
        </Stack>
      );
    }

    return (
      <Box sx={{ '& .header-link': { px: 2, '&:hover': { color: 'primary.main' } }, display: { xs: 'none', md: 'block' } }}>
        <Link
          className="header-link"
          color="white"
          component={RouterLink}
          to={isLoggedIn ? APP_DEFAULT_PATH : '/login'}
          target="_blank"
          underline="none"
        >
          {isLoggedIn ? 'Dashboard' : 'Login'}
        </Link>
        <Link className="header-link" color="white" component={RouterLink} to="/components-overview" underline="none">
          Components
        </Link>
        <Link className="header-link" color="white" href="https://codedthemes.gitbook.io/mantis/" target="_blank" underline="none">
          Documentation
        </Link>
        <Link
          className="header-link"
          sx={{ fontSize: 24, verticalAlign: 'middle' }}
          color="white"
          href="https://github.com/codedthemes/mantis-free-react-admin-template"
          target="_blank"
          underline="none"
        >
          <GithubOutlined />
        </Link>

        <Box sx={{ display: 'inline-block', ml: 1 }}>
          <AnimateButton>
            <Button
              component={Link}
              href="https://mui.com/store/items/mantis-react-admin-dashboard-template/"
              target="_blank"
              disableElevation
              color="primary"
              variant="contained"
            >
              Purchase Now
            </Button>
          </AnimateButton>
        </Box>
      </Box>
    );
  };

  const getMobileMenu = () => {
    if (variant === 'component') {
      return (
        <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
          <Button
            variant="outlined"
            size="small"
            color="warning"
            component={RouterLink}
            to={isLoggedIn ? APP_DEFAULT_PATH : '/login'}
            sx={{ height: 28 }}
          >
            {isLoggedIn ? 'Dashboard' : 'Login'}
          </Button>

          <IconButton
            color="secondary"
            onClick={handleComponentDrawerToggle}
            sx={(theme) => ({
              color: 'grey.100',
              '&:hover': { bgcolor: 'secondary.dark', color: 'grey.100' },
              ...theme.applyStyles('dark', { color: 'inherit', '&:hover': { bgcolor: 'secondary.lighter' } })
            })}
          >
            <MenuOutlined />
          </IconButton>
        </Stack>
      );
    }

    return (
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center' }}>
        <Button variant="outlined" size="small" color="warning" component={RouterLink} to="/components-overview" sx={{ height: 28 }}>
          All Components
        </Button>

        <IconButton
          color="secondary"
          onClick={drawerToggler(true)}
          sx={(theme) => ({
            color: 'grey.100',
            '&:hover': { bgcolor: 'secondary.dark', color: 'grey.100' },
            ...theme.applyStyles('dark', { color: 'inherit', '&:hover': { bgcolor: 'secondary.lighter' } })
          })}
        >
          <MenuOutlined />
        </IconButton>
      </Stack>
    );
  };

  const getDrawerContent = () => {
    if (variant === 'component') {
      return null; // Component variant doesn't use drawer
    }

    return (
      <Drawer anchor="top" open={drawerToggle} onClose={drawerToggler(false)}>
        <Box
          sx={{ width: 'auto', '& .MuiListItemIcon-root': { fontSize: '1rem', minWidth: 28 } }}
          role="presentation"
          onClick={drawerToggler(false)}
          onKeyDown={drawerToggler(false)}
        >
          <List>
            <Link underline="none" href={isLoggedIn ? APP_DEFAULT_PATH : '/login'} target="_blank">
              <ListItemButton>
                <ListItemIcon>
                  <LineOutlined />
                </ListItemIcon>
                <ListItemText
                  primary={isLoggedIn ? 'Dashboard' : 'Login'}
                  slotProps={{ primary: { variant: 'h6', color: 'text.primary' } }}
                />
              </ListItemButton>
            </Link>
            <Link underline="none" href="/components-overview" target="_blank">
              <ListItemButton>
                <ListItemIcon>
                  <LineOutlined />
                </ListItemIcon>
                <ListItemText primary="All Components" slotProps={{ primary: { variant: 'h6', color: 'text.primary' } }} />
              </ListItemButton>
            </Link>
            <Link underline="none" href="https://github.com/codedthemes/mantis-free-react-admin-template" target="_blank">
              <ListItemButton>
                <ListItemIcon>
                  <LineOutlined />
                </ListItemIcon>
                <ListItemText primary="Free Version" slotProps={{ primary: { variant: 'h6', color: 'text.primary' } }} />
              </ListItemButton>
            </Link>
            <Link underline="none" href="https://codedthemes.gitbook.io/mantis/" target="_blank">
              <ListItemButton>
                <ListItemIcon>
                  <LineOutlined />
                </ListItemIcon>
                <ListItemText primary="Documentation" slotProps={{ primary: { variant: 'h6', color: 'text.primary' } }} />
              </ListItemButton>
            </Link>
            <Link underline="none" href="https://codedthemes.support-hub.io/" target="_blank">
              <ListItemButton>
                <ListItemIcon>
                  <LineOutlined />
                </ListItemIcon>
                <ListItemText primary="Support" slotProps={{ primary: { variant: 'h6', color: 'text.primary' } }} />
              </ListItemButton>
            </Link>
            <Link underline="none" href="https://mui.com/store/items/mantis-react-admin-dashboard-template/" target="_blank">
              <ListItemButton>
                <ListItemIcon>
                  <LineOutlined />
                </ListItemIcon>
                <ListItemText primary="Purchase Now" slotProps={{ primary: { variant: 'h6', color: 'text.primary' } }} />
                <Chip color="primary" label={import.meta.env.VITE_APP_VERSION} size="small" />
              </ListItemButton>
            </Link>
          </List>
        </Box>
      </Drawer>
    );
  };

  const headerContent = (
    <AppBar
      sx={(theme) => ({
        bgcolor: 'grey.800',
        color: 'text.primary',
        boxShadow: 'none',
        ...theme.applyStyles('dark', { bgcolor: theme.vars.palette.grey[50] })
      })}
    >
      <ContainerWrapper>
        <Toolbar disableGutters sx={{ py: 2 }}>
          <Stack direction="row" sx={{ alignItems: 'center', flexGrow: 1, display: { xs: 'none', md: 'block' } }}>
            <Typography sx={{ textAlign: 'left', display: 'inline-block' }}>
              <Logo reverse to="/" />
            </Typography>
          </Stack>
          {getDesktopLinks()}
          <Box sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', display: { xs: 'flex', md: 'none' } }}>
            <Typography sx={{ textAlign: 'left', display: 'inline-block' }}>
              <Logo reverse to="/" />
            </Typography>
            {getMobileMenu()}
            {getDrawerContent()}
          </Box>
        </Toolbar>
      </ContainerWrapper>
    </AppBar>
  );

  if (enableElevationScroll) {
    return <ElevationScroll>{headerContent}</ElevationScroll>;
  }

  return headerContent;
}

ElevationScroll.propTypes = { children: PropTypes.any, window: PropTypes.any };

Header.propTypes = {
  variant: PropTypes.oneOf(['simple', 'component']),
  enableElevationScroll: PropTypes.bool,
  enableComponentDrawer: PropTypes.bool,
  onComponentDrawerToggle: PropTypes.func,
  isComponentDrawerOpened: PropTypes.bool
};
