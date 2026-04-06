import PropTypes from 'prop-types';
// material-ui
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

// project imports
import UserAvatar from './UserAvatar';
import Dot from 'components/@extended/Dot';
import SimpleBar from 'components/third-party/SimpleBar';

// assets
import CheckOutlined from '@ant-design/icons/CheckOutlined';

// ==============================|| CHAT - USER LIST ||============================== //

export default function UserList({ users, selectedUser, setUser, filter = 'all' }) {
  // Filtering logic (prefer explicit flags when available)
  const filteredUsers = users.filter((user) => {
    if (!user) return false;
    switch (filter) {
      case 'unread':
        return !!user.unReadChatCount && user.unReadChatCount > 0;
      case 'favorites':
        return user.isFavorite;
      case 'group':
        return user.isGroup;
      case 'all':
      default:
        return true;
    }
  });

  return (
    <SimpleBar sx={{ height: 'calc(100vh - 118px)', '& .simplebar-content': { display: 'flex', flexDirection: 'column' } }}>
      <List component="nav" disablePadding>
        {filteredUsers.map((user) => (
          <ListItemButton
            key={user.id}
            sx={{ p: { xs: 1.25, sm: 1.75 } }}
            onClick={() => {
              setUser(user);
            }}
            divider
            selected={user.id === selectedUser}
          >
            <ListItemAvatar>
              <UserAvatar user={user} />
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography
                  variant="h6"
                  color="text.primary"
                  sx={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {user.name}
                </Typography>
              }
              secondary={
                <Typography
                  component="span"
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 0.5,
                    alignItems: 'center',
                    '& .icon-read': { fontSize: 10, color: user.latestMessage?.seen ? 'success.main' : 'text.secondary' }
                  }}
                >
                  {user.unReadChatCount ? <Dot color="primary" /> : <CheckOutlined className="icon-read" />}
                  <Typography
                    component="span"
                    variant="caption"
                    color={user.latestMessage?.seen ? 'text.secondary' : 'text.primary'}
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: { xs: 180, sm: 280 },
                      ...(!user.latestMessage?.seen && { fontWeight: 500 })
                    }}
                  >
                    {user.latestMessage?.message}
                  </Typography>
                </Typography>
              }
            />
            <Typography component="span" color="text.secondary" variant="caption" sx={{ whiteSpace: 'nowrap' }}>
              {user.lastMessage}
            </Typography>
          </ListItemButton>
        ))}
      </List>
    </SimpleBar>
  );
}

UserList.propTypes = {
  users: PropTypes.array,
  selectedUser: PropTypes.oneOfType([PropTypes.any, PropTypes.number, PropTypes.string]),
  setUser: PropTypes.func,
  filter: PropTypes.oneOf(['all', 'unread', 'favorites', 'group'])
};
