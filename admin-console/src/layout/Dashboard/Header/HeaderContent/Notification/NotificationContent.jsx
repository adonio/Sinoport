import PropTypes from 'prop-types';
// material-ui
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import { notificationData, notificationFilterOptions } from './data';
import NotificationItem from './NotificationItem';
import Avatar from 'components/@extended/Avatar';
import MainCard from 'components/MainCard';
import SimpleBar from 'components/third-party/SimpleBar';

// ==============================|| NOTIFICATION - CONTENT ||============================== //

export default function NotificationContent({ notifications, filter, setFilter, onMarkAllRead }) {
  return (
    <MainCard
      title={<Typography variant="h5">Notification</Typography>}
      sx={{ border: 'none', borderRadius: 0, height: '100vh', '& .MuiCardHeader-root': { p: 2.25 } }}
      content={false}
      secondary={
        <Link href="#" underline="hover" typography="caption" sx={{ textTransform: 'none' }} onClick={onMarkAllRead}>
          Make all as read
        </Link>
      }
    >
      {/* Notification Filter Chips */}
      <Stack
        direction="row"
        sx={{ py: 1.5, px: 2.5, gap: 1.25, alignItems: 'center', borderBottom: '1px solid', borderBottomColor: 'divider' }}
      >
        {notificationFilterOptions.map((opt, index) => (
          <Chip
            key={index}
            label={opt.label}
            color={filter === opt.key ? 'primary' : 'secondary'}
            variant="combined"
            clickable
            onClick={setFilter(opt.key)}
            sx={{
              flexDirection: 'row-reverse',
              '& .MuiChip-avatar': { width: 20, height: 20, ml: -0.5, mr: 0.5 },
              ...(filter !== opt.key && { border: '1px solid transparent !important' })
            }}
            {...{
              ...(opt.key === 'all' && {
                avatar: <Avatar size="xs">{notificationData.length}</Avatar>
              })
            }}
          />
        ))}
      </Stack>

      {/* Notification List */}
      <Box>
        <SimpleBar sx={{ overflowX: 'hidden', height: 'calc(100vh - 175px)', minHeight: 420 }}>
          <List component="nav" disablePadding>
            {notifications.map((notification, index) => (
              <NotificationItem key={index} notification={notification} />
            ))}
          </List>
        </SimpleBar>
      </Box>

      {/* Footer Button */}
      <Stack sx={{ py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button sx={{ alignSelf: 'center' }}>View All Notifications</Button>
      </Stack>
    </MainCard>
  );
}

NotificationContent.propTypes = {
  notifications: PropTypes.array,
  filter: PropTypes.oneOf(['all', 'unread', 'mentions']),
  setFilter: PropTypes.func,
  onMarkAllRead: PropTypes.func
};
