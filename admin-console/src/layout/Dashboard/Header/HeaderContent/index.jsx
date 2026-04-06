import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';

import FullScreen from './FullScreen';
import Localization from './Localization';
import MobileSection from './MobileSection';
import Profile from './Profile';
import Search from './Search';
import Workspace from './Workspace';

import { MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import DrawerHeader from 'layout/Dashboard/Drawer/DrawerHeader';

export default function HeaderContent() {
  const { state } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const localization = useMemo(() => <Localization />, []);

  return (
    <>
      {state.menuOrientation === MenuOrientation.HORIZONTAL && !downLG && <DrawerHeader open={true} />}
      {!downLG && (
        <Stack direction="row" sx={{ gap: 2, ml: 1 }}>
          <Workspace />
          <Divider orientation="vertical" flexItem sx={{ height: 22, alignSelf: 'center' }} />
          <Search />
        </Stack>
      )}

      <Box sx={{ width: 1, ml: 1 }} />

      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
        {localization}
        {!downLG && <FullScreen />}
        {!downLG && <Profile />}
        {downLG && <MobileSection />}
      </Stack>
    </>
  );
}
