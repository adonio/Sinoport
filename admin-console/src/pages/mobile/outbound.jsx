import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import RightOutlined from '@ant-design/icons/RightOutlined';
import BarcodeOutlined from '@ant-design/icons/BarcodeOutlined';
import CarOutlined from '@ant-design/icons/CarOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import { outboundFlights } from 'data/sinoport';
import { getMobileRoleKey, readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { t } from 'utils/mobile/i18n';
import { getMobileRoleView, isMobileTabAllowed } from 'data/sinoport-adapters';

export default function MobileOutboundPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';
  const roleKey = getMobileRoleKey(session);
  const roleView = getMobileRoleView(roleKey);

  const taskEntries = [
    { key: 'receipt', label: t(language, 'receipt'), pathOf: (flightNo) => `/mobile/outbound/${flightNo}/receipt`, icon: InboxOutlined },
    { key: 'container', label: t(language, 'container'), pathOf: (flightNo) => `/mobile/outbound/${flightNo}/pmc`, icon: BarcodeOutlined },
    { key: 'loading', label: language === 'en' ? 'Aircraft' : '装机', pathOf: (flightNo) => `/mobile/outbound/${flightNo}/loading`, icon: CarOutlined },
    { key: 'overview', label: t(language, 'overview'), pathOf: (flightNo) => `/mobile/outbound/${flightNo}`, icon: RightOutlined }
  ].filter((item) => isMobileTabAllowed(roleKey, 'outbound', item.key));

  useEffect(() => {
    const current = readMobileSession();
    if (current && current.businessType !== '出港') {
      writeMobileSession({ ...current, businessType: '出港' });
    }
  }, []);

  return (
    <Stack sx={{ gap: 2 }}>
      <MainCard>
        <Stack sx={{ gap: 0.75 }}>
          <Typography variant="overline" color="primary.main">
            {t(language, 'outbound')}
          </Typography>
          <Typography variant="h4">{t(language, 'select_flight')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(language, 'outbound_flight_tip')}
          </Typography>
        </Stack>
      </MainCard>

      {outboundFlights.map((flight) => (
        <MainCard
          key={flight.flightNo}
          sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
          onClick={() => navigate(`/mobile/outbound/${flight.flightNo}`)}
        >
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
              <div>
                <Typography variant="h5">{flight.flightNo}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t(language, 'etd')} {flight.etd} · {t(language, 'current_step')} {flight.stage}
                </Typography>
              </div>
              <StatusChip label={flight.status} />
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {t(language, 'manifest')}：{flight.manifest} · {flight.cargo}
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
