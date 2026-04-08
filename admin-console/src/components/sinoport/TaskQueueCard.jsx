import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';

export default function TaskQueueCard({ title, items, emptyText = '暂无数据。' }) {
  return (
    <MainCard title={title}>
      <Stack sx={{ gap: 1.25 }}>
        {items.length ? (
          items.map((item) => (
            <Box key={item.id || item.title} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
                <Stack sx={{ gap: 0.35, minWidth: 0 }}>
                  <Typography variant="subtitle2">{item.title}</Typography>
                  {item.description ? (
                    <Typography variant="body2" color="text.secondary">
                      {item.description}
                    </Typography>
                  ) : null}
                </Stack>
                {item.status ? <StatusChip label={item.status} /> : null}
              </Stack>
              {item.meta ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {item.meta}
                </Typography>
              ) : null}
            </Box>
          ))
        ) : (
          <Typography color="text.secondary">{emptyText}</Typography>
        )}
      </Stack>
    </MainCard>
  );
}

TaskQueueCard.propTypes = {
  emptyText: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      description: PropTypes.string,
      id: PropTypes.string,
      meta: PropTypes.string,
      status: PropTypes.string,
      title: PropTypes.string.isRequired
    })
  ).isRequired,
  title: PropTypes.string.isRequired
};
