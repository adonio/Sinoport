import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import RightOutlined from '@ant-design/icons/RightOutlined';
import BarcodeOutlined from '@ant-design/icons/BarcodeOutlined';
import CarOutlined from '@ant-design/icons/CarOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundFlights } from 'data/sinoport';
import { getMobileRoleKey, readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { t } from 'utils/mobile/i18n';
import { getMobileRoleView, isMobileTabAllowed } from 'data/sinoport-adapters';

export default function MobileInboundPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';
  const roleKey = getMobileRoleKey(session);
  const roleView = getMobileRoleView(roleKey);

  const taskEntries = [
    { key: 'counting', label: t(language, 'counting'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}/breakdown`, icon: BarcodeOutlined },
    { key: 'pallet', label: t(language, 'pallet'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}/pallet`, icon: InboxOutlined },
    { key: 'loading', label: t(language, 'loading'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}/loading`, icon: CarOutlined },
    { key: 'overview', label: t(language, 'overview'), pathOf: (flightNo) => `/mobile/inbound/${flightNo}`, icon: RightOutlined }
  ].filter((item) => isMobileTabAllowed(roleKey, 'inbound', item.key));

  useEffect(() => {
    const current = readMobileSession();
    if (current && current.businessType !== '进港') {
      writeMobileSession({ ...current, businessType: '进港' });
    }
  }, []);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Stack sx={{ gap: 0.75 }}>
          <Typography variant="overline" color="primary.main">
            {t(language, 'inbound')}
          </Typography>
          <Typography variant="h4">{t(language, 'select_flight')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(language, 'inbound_flight_tip')}
          </Typography>
        </Stack>
      </MainCard>

      {inboundFlights.map((flight) => (
        <MainCard
          key={flight.flightNo}
          sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
          onClick={() => navigate(`/mobile/inbound/${flight.flightNo}`)}
        >
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
              <div>
                <Typography variant="h5">{flight.flightNo}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t(language, 'source')} {flight.source} · {t(language, 'eta')} {flight.eta}
                </Typography>
              </div>
              <StatusChip label={flight.status} />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {t(language, 'current_step')}：{flight.step} · {t(language, 'priority')} {flight.priority} · {flight.cargo}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              当前角色：{roleView.label}
            </Typography>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {taskEntries.map((entry, index) => (
                <Button
                  key={`${flight.flightNo}-${entry.key}`}
                  size="small"
                  variant={index === 0 ? 'contained' : 'outlined'}
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(entry.pathOf(flight.flightNo));
                  }}
                >
                  {index === 0 ? `进入${entry.label}` : entry.label}
                </Button>
              ))}
            </Stack>
          </Stack>
        </MainCard>
      ))}
    </Stack>
  );
}
