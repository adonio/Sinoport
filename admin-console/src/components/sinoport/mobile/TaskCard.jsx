import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import TaskActionBar from 'components/sinoport/mobile/TaskActionBar';
import TaskBlockerNotice from 'components/sinoport/mobile/TaskBlockerNotice';
import TaskEvidenceSection from 'components/sinoport/mobile/TaskEvidenceSection';
import { formatLocalizedMessage } from 'utils/app-i18n';
import { localizeMobileText } from 'utils/mobile/i18n';

export default function TaskCard({ title, node, role, status, priority, sla, description, evidence = [], blockers = [], actions = [] }) {
  const intl = useIntl();
  const locale = intl.locale;
  const mt = (value) => localizeMobileText(locale, value);
  const normalizeEnglishTaskCardText = (value) => {
    if (locale !== 'en' || value == null) return value;

    return String(value)
      .replace(/FINAL\s*MILE.*?LOADING与运输/giu, 'Final Mile Truck Loading and Transport')
      .replace(/OUTBOUND.*?机坪.*?ACTIONS/giu, 'Outbound Airport Ramp Operations')
      .replace(/尾程卡车装车与运输/gu, 'Final Mile Truck Loading and Transport')
      .replace(/理货Node 30 分钟初判/gu, 'Initial judgment within 30 minutes at the counting node')
      .replace(/理货节点 30 分钟初判/gu, 'Initial judgment within 30 minutes at the counting node')
      .replace(/VehiCle到场后 15 分钟内启动/gu, 'Start within 15 minutes after vehicle arrival')
      .replace(/车辆到场后 15 分钟内启动/gu, 'Start within 15 minutes after vehicle arrival')
      .replace(/Load to AirCraft前 45 分钟/giu, '45 minutes before load to aircraft')
      .replace(/Airborne前闭环/gu, 'close before airborne')
      .replace(/ETD 前 30 分钟/gu, '30 minutes before ETD');
  };
  const renderTaskCardText = (value) =>
    locale === 'en' ? normalizeEnglishTaskCardText(mt(normalizeEnglishTaskCardText(value))) : mt(value);
  const localizedSla = renderTaskCardText(sla);
  const normalizedSla =
    locale === 'en'
      ? String(localizedSla)
          .replace(/^SLA\s*/u, '')
          .replace(/ReCeiving后 30 分钟/gu, '30 minutes after receiving')
      : localizedSla;

  return (
    <MainCard>
      <Stack sx={{ gap: 1.5 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start' }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="overline" color="primary.main">
              {renderTaskCardText(node)}
            </Typography>
            <Typography variant="h5">{renderTaskCardText(title)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {renderTaskCardText(description)}
            </Typography>
          </Stack>
          <StatusChip label={renderTaskCardText(status)} />
        </Stack>

        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={locale === 'en' ? `${formatLocalizedMessage(intl, '角色')} ${renderTaskCardText(role)}` : mt(`${formatLocalizedMessage(intl, '角色')} ${mt(role)}`)}
            color="secondary"
            variant="light"
          />
          <Chip
            size="small"
            label={
              locale === 'en'
                ? `${formatLocalizedMessage(intl, '优先级')} ${renderTaskCardText(priority)}`
                : mt(`${formatLocalizedMessage(intl, '优先级')} ${mt(priority)}`)
            }
            color="warning"
            variant="light"
          />
          <Chip size="small" label={locale === 'en' ? `SLA ${normalizedSla}` : mt(`SLA ${sla}`)} color="info" variant="light" />
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
