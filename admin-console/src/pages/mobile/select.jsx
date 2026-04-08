import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import RightOutlined from '@ant-design/icons/RightOutlined';

import MainCard from 'components/MainCard';
import { mobileNodeOptions } from 'data/sinoport-adapters';
import { readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { localizeMobileText, t } from 'utils/mobile/i18n';

export default function MobileSelectPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';
  const nodeOptions = mobileNodeOptions.map((item) => ({
    ...item,
    title: localizeMobileText(language, item.title),
    description: localizeMobileText(language, item.description),
    enterLabel: t(language, 'open_node')
  }));

  return (
    <Stack sx={{ gap: 2.5 }}>
      <MainCard contentSX={{ p: 2.5 }}>
        <Typography variant="overline" color="primary.main">
          {t(language, 'login_success')}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
          {t(language, 'select_node_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {session?.station} · {session?.operator}
        </Typography>
      </MainCard>

      <Grid container spacing={2}>
        {nodeOptions.map((option) => (
          <Grid key={option.key} size={12}>
            <MainCard
              sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
              onClick={() => {
                writeMobileSession({ ...session, selectedNode: option.key });
                navigate(option.path);
              }}
            >
              <Stack sx={{ gap: 2 }}>
                <div>
                  <Typography variant="h5">{option.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {option.description}
                  </Typography>
                </div>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" color="primary.main">
                    {option.enterLabel}
                  </Typography>
                  <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
                    <RightOutlined />
                  </Box>
                </Stack>
              </Stack>
            </MainCard>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
