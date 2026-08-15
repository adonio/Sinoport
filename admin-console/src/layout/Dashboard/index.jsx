import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

// project imports
import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import HorizontalBar from './Drawer/HorizontalBar';
import Loader from 'components/Loader';
import Breadcrumbs from 'components/@extended/Breadcrumbs';
import AuthGuard from 'utils/route-guard/AuthGuard';

import { MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import useAuth from 'hooks/useAuth';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { changeStationPassword } from 'utils/stationApi';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const { menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { state } = useConfig();
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const isContainer = state.container;
  const isHorizontal = state.menuOrientation === MenuOrientation.HORIZONTAL && !downLG;

  // set media wise responsive drawer
  useEffect(() => {
    if (state.menuOrientation !== MenuOrientation.MINI_VERTICAL) {
      handlerDrawerOpen(!downXL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downXL]);

  if (menuMasterLoading) return <Loader />;

  const handleRequiredPasswordChange = async () => {
    if (newPassword.length < 10 || newPassword !== confirmPassword) return;
    setPasswordSubmitting(true);
    setPasswordError('');
    try {
      await changeStationPassword(currentPassword, newPassword);
      await logout();
    } catch (error) {
      setPasswordError(error?.response?.data?.error?.message || '密码修改失败，请检查当前密码。');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <Box data-dashboard-shell="true" sx={{ display: 'flex', width: '100%' }}>
        <Header />
        {!isHorizontal ? <Drawer /> : <HorizontalBar />}

        <Box component="main" sx={{ width: 'calc(100% - 260px)', flexGrow: 1, p: { xs: 2, sm: 3 } }}>
          <Toolbar sx={{ mt: isHorizontal ? 8 : 'inherit' }} />
          <Container
            maxWidth={isContainer ? 'xl' : false}
            sx={{
              ...(isContainer && { px: { xs: 0, sm: 2 } }),
              position: 'relative',
              minHeight: 'calc(100vh - 110px)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {pathname !== '/apps/profiles/account/my-account' && <Breadcrumbs />}
            <Outlet />
            <Footer />
          </Container>
        </Box>
      </Box>
      <Dialog open={Boolean(user?.mustChangePassword)} disableEscapeKeyDown fullWidth maxWidth="sm">
        <DialogTitle>首次登录，请修改初始密码</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            <Alert severity="warning">新密码至少 10 位。修改成功后需要使用新密码重新登录。</Alert>
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            <TextField type="password" label="当前密码" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} fullWidth />
            <TextField type="password" label="新密码" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} fullWidth helperText="至少 10 位字符" />
            <TextField type="password" label="确认新密码" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} fullWidth error={Boolean(confirmPassword && newPassword !== confirmPassword)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleRequiredPasswordChange} disabled={passwordSubmitting || !currentPassword || newPassword.length < 10 || newPassword !== confirmPassword}>
            修改密码并重新登录
          </Button>
        </DialogActions>
      </Dialog>
    </AuthGuard>
  );
}
