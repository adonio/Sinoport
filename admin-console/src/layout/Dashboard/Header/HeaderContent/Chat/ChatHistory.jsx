import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';

import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import UserAvatar from './UserAvatar';
import MainCard from 'components/MainCard';
import SimpleBar from 'components/third-party/SimpleBar';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';

import { useGetUserChat } from 'api/chat';

// assets
import CheckOutlined from '@ant-design/icons/CheckOutlined';

// ==============================|| CHAT MESSAGE HISTORY ||============================== //

export default function ChatHistoryPage({ user }) {
  const bottomRef = useRef(null);
  const { chat, chatLoading } = useGetUserChat(user.name);

  useEffect(() => {
    // @ts-ignore
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat]);

  if (chatLoading) {
    return (
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 410px)' }}>
        <CircularWithPath />
      </Stack>
    );
  }

  // 1. Determine the filtered chat history based on user.isGroup
  const filteredChat = chat.filter((item) => (user.isGroup ? item.type === 'group' : item.type !== 'group'));

  // Component for a 'Sent' message bubble (Right-aligned)
  const SentMessage = ({ history }) => (
    <Stack direction="row" sx={{ width: 1, gap: 1.25, justifyContent: 'flex-end' }}>
      <Stack sx={{ maxWidth: 250 }}>
        <MainCard content={false} border={false} sx={{ ml: 0.75, p: 1.25, bgcolor: 'secondary.200' }}>
          <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {history.text}
          </Typography>
        </MainCard>
        <Stack
          direction="row"
          sx={{
            mt: 0.25,
            gap: 0.5,
            justifyContent: 'flex-end',
            alignItems: 'center',
            '& .icon-read': { fontSize: 10, color: history.seen ? 'success.main' : 'text.secondary' }
          }}
        >
          <CheckOutlined className="icon-read" />
          <Divider orientation="vertical" flexItem sx={{ mt: -0.25, height: 12, alignSelf: 'center', borderColor: 'grey.300' }} />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
            {history.time}
          </Typography>
        </Stack>
      </Stack>
      {/* Assuming the 'User 1' structure is for the current user's avatar when they send a message */}
      <Box>
        <UserAvatar user={{ online_status: 'available', avatar: 'avatar-1.png', name: 'User 1' }} />
      </Box>
    </Stack>
  );

  // Component for a 'Received' message bubble (Left-aligned)
  const ReceivedMessage = ({ history, user }) => (
    <Stack direction="row" sx={{ width: 1, gap: 1.25 }}>
      <Box>
        <UserAvatar
          user={{
            online_status: user.online_status,
            avatar: user.avatar,
            // In group chat, use history.from as name, otherwise use the peer's name
            name: user.isGroup ? history.from : user.name
          }}
        />
      </Box>
      <Stack sx={{ gap: 0.25, maxWidth: 250 }}>
        <MainCard
          content={false}
          border={false}
          sx={(theme) => ({
            p: 1.25,
            bgcolor: 'primary.lighter',
            ...theme.applyStyles('dark', { bgcolor: 'background.default' })
          })}
        >
          <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {history.text}
          </Typography>
        </MainCard>
        <Typography variant="body2" color="text.secondary">
          {history.time}
        </Typography>
      </Stack>
    </Stack>
  );

  return (
    <SimpleBar sx={{ overflowX: 'hidden', height: 'calc(100vh - 250px)', minHeight: 420, '& .simplebar-content': { height: '100%' } }}>
      <Box sx={{ p: { xs: 1.25, sm: 2 }, height: '100%' }}>
        <Grid container spacing={2.5}>
          {filteredChat.map((history, index) => {
            // Determine the sender logic based on chat type
            let isMyMessage;
            if (user.isGroup) {
              // Group chat: Check history.from against a known user ID/name (e.g., 'User1')
              isMyMessage = history.from === 'User1';
            } else {
              // Private chat: Check history.to against the current user's name
              isMyMessage = history.to === user.name;
            }

            return (
              // Using a unique ID is much better than 'index' for the key, if possible
              <Grid key={history.id || index} size={12} sx={{ width: 1 }}>
                {isMyMessage ? <SentMessage history={history} /> : <ReceivedMessage history={history} user={user} />}
              </Grid>
            );
          })}
          <Grid ref={bottomRef} />
        </Grid>
      </Box>
    </SimpleBar>
  );
}

ChatHistoryPage.propTypes = { user: PropTypes.any };
