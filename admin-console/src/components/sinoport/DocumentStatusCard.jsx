import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function DocumentStatusCard({ title, items }) {
  const intl = useIntl();
  const locale = intl.locale;
  return (
    <MainCard title={formatLocalizedMessage(intl, title)}>
      <Stack sx={{ gap: 1.25 }}>
        {items.map((item) => (
          <Box key={`${item.node}-${item.required}`} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
              <Stack sx={{ gap: 0.35 }}>
                {item.gateId ? (
                  <Typography variant="caption" color="primary.main">
                    {item.gateId}
                  </Typography>
                ) : null}
                <Typography variant="subtitle2">{localizeUiText(locale, item.node)}</Typography>
              </Stack>
              <StatusChip label={localizeUiText(locale, item.status)} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {formatLocalizedMessage(intl, '必须文件：')}{localizeUiText(locale, item.required)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {formatLocalizedMessage(intl, '放行结果：')}{localizeUiText(locale, item.impact)}
            </Typography>
            {item.blocker ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {formatLocalizedMessage(intl, '阻断原因：')}{localizeUiText(locale, item.blocker)}
              </Typography>
            ) : null}
            {item.recovery ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {formatLocalizedMessage(intl, '恢复动作：')}{localizeUiText(locale, item.recovery)}
              </Typography>
            ) : null}
            {item.releaseRole ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {formatLocalizedMessage(intl, '放行角色：')}{localizeUiText(locale, item.releaseRole)}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Stack>
    </MainCard>
  );
}

DocumentStatusCard.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      blocker: PropTypes.string,
      gateId: PropTypes.string,
      impact: PropTypes.string.isRequired,
      node: PropTypes.string.isRequired,
      required: PropTypes.string.isRequired,
      releaseRole: PropTypes.string,
      recovery: PropTypes.string,
      status: PropTypes.string.isRequired
    })
  ).isRequired,
  title: PropTypes.string.isRequired
};
