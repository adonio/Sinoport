import PropTypes from 'prop-types';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import TaskActionBar from 'components/sinoport/mobile/TaskActionBar';
import TaskBlockerNotice from 'components/sinoport/mobile/TaskBlockerNotice';
import TaskEvidenceSection from 'components/sinoport/mobile/TaskEvidenceSection';

export default function TaskCard({ title, node, role, status, priority, sla, description, evidence = [], blockers = [], actions = [] }) {
  return (
    <MainCard>
      <Stack sx={{ gap: 1.5 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="overline" color="primary.main">
              {node}
            </Typography>
            <Typography variant="h5">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Stack>
          <StatusChip label={status} />
        </Stack>

        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label={`角色 ${role}`} color="secondary" variant="light" />
          <Chip size="small" label={`优先级 ${priority}`} color="warning" variant="light" />
          <Chip size="small" label={`SLA ${sla}`} color="info" variant="light" />
        </Stack>

        {blockers.length ? <TaskBlockerNotice blockers={blockers} /> : null}
        {evidence.length ? <TaskEvidenceSection evidence={evidence} /> : null}
        {actions.length ? <TaskActionBar actions={actions} /> : null}
      </Stack>
    </MainCard>
  );
}

TaskCard.propTypes = {
  actions: PropTypes.array,
  blockers: PropTypes.array,
  description: PropTypes.string.isRequired,
  evidence: PropTypes.array,
  node: PropTypes.string.isRequired,
  priority: PropTypes.string.isRequired,
  role: PropTypes.string.isRequired,
  sla: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired
};
