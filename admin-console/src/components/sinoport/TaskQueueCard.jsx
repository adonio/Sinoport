import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
              {item.actions?.length ? (
                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
                  {item.actions.map((action) => (
                    <Button
                      key={`${item.id || item.title}-${action.label}`}
                      component={action.to ? RouterLink : 'button'}
                      to={action.to}
                      size="small"
                      variant={action.variant || 'outlined'}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Stack>
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
      actions: PropTypes.arrayOf(
        PropTypes.shape({
          label: PropTypes.string.isRequired,
          to: PropTypes.string,
          variant: PropTypes.string
        })
      ),
      status: PropTypes.string,
      title: PropTypes.string.isRequired
    })
  ).isRequired,
  title: PropTypes.string.isRequired
};
