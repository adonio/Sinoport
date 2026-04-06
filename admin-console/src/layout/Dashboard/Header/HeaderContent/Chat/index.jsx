import { useState } from 'react';

// material-ui
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// third-party
import { useGetUsers } from 'api/chat';

// project imports
import UserList from './UserList';
import ChatHistory from './ChatHistory';
import ChatMessageSend from './ChatMessageSend';

import MainCard from 'components/MainCard';
import IconButton from 'components/@extended/IconButton';

// assets
import { ArrowLeftOutlined, MessageOutlined } from '@ant-design/icons';

const userFilterOptions = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'group', label: 'Group' }
];

// ==============================|| HEADER CONTENT - CUSTOMIZATION ||============================== //

export default function Chat() {
  const { usersLoading, users } = useGetUsers();

  const [user, setUser] = useState({});
  const selectedUser = usersLoading || Object.keys(user).length === 0 ? null : user.id;

  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    setOpen(!open);
  };

  // chat filters: 'all' | 'unread' | 'favorites' | 'group'
  const [filter, setFilter] = useState('all');
  const handleFilterChange = (value) => () => {
    setFilter(value);
  };

  return (
    <>
      <Box sx={{ flexShrink: 0 }}>
        <Tooltip title="Quick Chat">
          <IconButton
            color="secondary"
            variant="light"
            sx={(theme) => ({
              color: 'text.primary',
              bgcolor: open ? 'grey.100' : 'transparent',
              ...theme.applyStyles('dark', { bgcolor: open ? 'background.default' : 'transparent' })
            })}
            aria-label="open chat"
            onClick={handleToggle}
          >
            <MessageOutlined />
          </IconButton>
        </Tooltip>
      </Box>
      <Drawer
        sx={{ zIndex: 2001 }}
        anchor="right"
        onClose={handleToggle}
        open={open}
        slotProps={{ paper: { sx: { width: { xs: 340, sm: 440 } } } }}
      >
        {open && (
          <MainCard
            title={
              <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
                {selectedUser !== null && (
                  <IconButton size="small" color="secondary" onClick={() => setUser({})} sx={{ fontSize: '1rem', color: 'text.primary' }}>
                    <ArrowLeftOutlined />
                  </IconButton>
                )}
                <Typography variant="h5">{selectedUser === null ? 'Chat' : user.name}</Typography>
              </Stack>
            }
            sx={{
              border: 'none',
              borderRadius: 0,
              height: '100vh',
              '& .MuiCardHeader-root': { p: selectedUser === null ? 2.25 : 1.875 }
            }}
            content={false}
            secondary={
              <>
                {selectedUser === null && (
                  <Link href="#" underline="hover" typography="caption" sx={{ textTransform: 'none' }}>
                    Make all as read
                  </Link>
                )}
              </>
            }
          >
            <>
              {selectedUser !== null ? (
                <Stack sx={{ gap: 1.25 }}>
                  <ChatHistory user={user} />
                  <ChatMessageSend {...{ user }} />
                </Stack>
              ) : (
                <>
                  <Stack
                    direction="row"
                    sx={{ py: 1.5, px: 2.5, gap: 1.25, alignItems: 'center', borderBottom: '1px solid', borderBottomColor: 'divider' }}
                  >
                    {userFilterOptions.map((opt) => (
                      <Chip
                        key={opt.key}
                        label={opt.label}
                        color={filter === opt.key ? 'primary' : 'secondary'}
                        variant={filter === opt.key ? 'combined' : 'light'}
                        clickable
                        onClick={handleFilterChange(opt.key)}
                        sx={{ ...(filter !== opt.key && { border: '1px solid transparent !important' }) }}
                      />
                    ))}
                  </Stack>
                  <UserList users={users} selectedUser={selectedUser} setUser={setUser} filter={filter} />
                </>
              )}
            </>
          </MainCard>
        )}
      </Drawer>
    </>
  );
}
