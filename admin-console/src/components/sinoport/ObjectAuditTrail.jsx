import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';

function AuditList({ emptyText, items, mode }) {
  if (!items.length) {
    return <Typography color="text.secondary">{emptyText}</Typography>;
  }

  return (
    <Stack sx={{ gap: 1.25 }}>
      {items.map((item) => (
        <Box key={item.id} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
            <Stack sx={{ gap: 0.35, minWidth: 0 }}>
              <Typography variant="subtitle2">{item.action}</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.object}
              </Typography>
            </Stack>
            <StatusChip label={mode === 'events' ? 'Audit' : 'State'} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {item.time} · {item.actor}
          </Typography>
          {mode === 'transitions' ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {item.before} → {item.after}
            </Typography>
          ) : null}
          {item.note ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {item.note}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Stack>
  );
}

AuditList.propTypes = {
  emptyText: PropTypes.string.isRequired,
  items: PropTypes.array.isRequired,
  mode: PropTypes.oneOf(['events', 'transitions']).isRequired
};

export default function ObjectAuditTrail({ events = [], transitions = [], title = '对象审计' }) {
  return (
    <MainCard title={title}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <Stack sx={{ gap: 1 }}>
            <Typography variant="subtitle2">审计事件</Typography>
            <AuditList emptyText="当前对象还没有审计事件。" items={events} mode="events" />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <Stack sx={{ gap: 1 }}>
            <Typography variant="subtitle2">状态迁移</Typography>
            <AuditList emptyText="当前对象还没有状态迁移记录。" items={transitions} mode="transitions" />
          </Stack>
        </Grid>
      </Grid>
    </MainCard>
  );
}

ObjectAuditTrail.propTypes = {
  events: PropTypes.array,
  title: PropTypes.string,
  transitions: PropTypes.array
};
