import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIntl } from 'react-intl';

import useMediaQuery from '@mui/material/useMediaQuery';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ApartmentOutlined from '@ant-design/icons/ApartmentOutlined';
import ImportOutlined from '@ant-design/icons/ImportOutlined';
import MobileOutlined from '@ant-design/icons/MobileOutlined';

// project imports
import NavItem from './NavItem';
import NavGroup from './NavGroup';
import menuItems from 'menu-items';

import useConfig from 'hooks/useConfig';
import { HORIZONTAL_MAX_ITEM, MenuOrientation } from 'config';
import { useGetMenuMaster } from 'api/menu';
import { formatLocalizedMessage } from 'utils/app-i18n';

// ==============================|| DRAWER CONTENT - NAVIGATION ||============================== //

export default function Navigation() {
  const intl = useIntl();
  const { state } = useConfig();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const location = useLocation();

  const [selectedID, setSelectedID] = useState('');
  const [selectedItems, setSelectedItems] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(0);

  const isHorizontal = state.menuOrientation === MenuOrientation.HORIZONTAL && !downLG;
  const isStationRoute = location.pathname.startsWith('/station');

  const backendSwitchGroup = {
    id: 'backend-switch-group',
    title: formatLocalizedMessage(intl, '后台切换'),
    type: 'group',
    children: [
      isStationRoute
        ? {
            id: 'switch-to-platform',
            title: formatLocalizedMessage(intl, '平台'),
            type: 'item',
            url: '/platform/operations',
            icon: ApartmentOutlined
          }
        : {
            id: 'switch-to-station',
            title: formatLocalizedMessage(intl, '货站'),
            type: 'item',
            url: '/station/dashboard',
            icon: ImportOutlined
          },
      {
        id: 'switch-to-mobile',
        title: formatLocalizedMessage(intl, '移动端'),
        type: 'item',
        url: '/mobile/select',
        icon: MobileOutlined
      }
    ]
  };

  const navigationItems = [
    ...menuItems.items.filter((item) => item.id === (isStationRoute ? 'station-group' : 'platform-group')),
    backendSwitchGroup
  ];

  const lastItem = isHorizontal ? HORIZONTAL_MAX_ITEM : null;
  let lastItemIndex = navigationItems.length - 1;
  let remItems = [];
  let lastItemId;

  //  first it checks menu item is more than giving HORIZONTAL_MAX_ITEM after that get lastItemid by giving horizontal max
  // item and it sets horizontal menu by giving horizontal max item lastly slice menuItem from array and set into remItems

  if (lastItem && lastItem < navigationItems.length) {
    lastItemId = navigationItems[lastItem - 1].id;
    lastItemIndex = lastItem - 1;
    remItems = navigationItems.slice(lastItem - 1, navigationItems.length).map((item) => ({
      title: item.title,
      elements: item.children,
      icon: item.icon,
      ...(item.url && {
        url: item.url
      })
    }));
  }

  const navGroups = navigationItems.slice(0, lastItemIndex + 1).map((item, index) => {
    switch (item.type) {
      case 'group':
        if (item.url && item.id !== lastItemId) {
          return (
            <List key={item.id} sx={{ zIndex: 0, ...(isHorizontal && { mt: 0.5 }) }}>
              {!isHorizontal && index !== 0 && <Divider sx={{ my: 0.5 }} />}
              <NavItem item={item} level={1} isParents setSelectedID={setSelectedID} />
            </List>
          );
        }

        return (
          <NavGroup
            key={item.id}
            setSelectedID={setSelectedID}
            setSelectedItems={setSelectedItems}
            setSelectedLevel={setSelectedLevel}
            selectedLevel={selectedLevel}
            selectedID={selectedID}
            selectedItems={selectedItems}
            lastItem={lastItem}
            remItems={remItems}
            lastItemId={lastItemId}
            item={item}
          />
        );
      default:
        return (
          <Typography key={item.id} variant="h6" color="error" align="center">
            {formatLocalizedMessage(intl, 'Fix - Navigation Group')}
          </Typography>
        );
    }
  });

  return (
    <Box
      sx={{
        pt: drawerOpen ? (isHorizontal ? 0 : 2) : 0,
        ...(!isHorizontal && { '& > ul:first-of-type': { mt: 0 } }),
        display: isHorizontal ? { xs: 'block', lg: 'flex' } : 'block'
      }}
    >
      {navGroups}
    </Box>
  );
}
