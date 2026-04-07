import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import RightOutlined from '@ant-design/icons/RightOutlined';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundFlights } from 'data/sinoport';
import { readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { t } from 'utils/mobile/i18n';

export default function MobileInboundPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';

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

            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" color="primary.main">
                {t(language, 'enter_flight_operation')}
              </Typography>
              <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                <RightOutlined />
              </Box>
            </Stack>
          </Stack>
        </MainCard>
      ))}
    </Stack>
  );
}
