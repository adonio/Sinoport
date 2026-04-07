import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import sinoportLogo from 'assets/images/sinoport-logo.png';
import { writeMobileSession } from 'utils/mobile/session';
import { getMobileLanguageOptions, localizeMobileText, readMobileLanguage, t, writeMobileLanguage } from 'utils/mobile/i18n';

const stationOptions = [
  { value: 'mme', label: 'MME 样板站' },
  { value: 'urc', label: 'URC 前置站' },
  { value: 'mst', label: 'MST 分拨站' },
  { value: 'boh', label: 'BoH 航站' }
];

export default function MobileLoginPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(readMobileLanguage());
  const languageOptions = getMobileLanguageOptions(language);
  const [form, setForm] = useState({
    operator: '',
    employeeId: '',
    station: stationOptions[0].value
  });

  const canSubmit = form.operator.trim() && form.employeeId.trim() && form.station;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: { xs: 2, sm: 6 } }}>
      <Box sx={{ maxWidth: 480, mx: 'auto', px: 2 }}>
        <MainCard>
          <Stack sx={{ gap: 3 }}>
            <Stack sx={{ alignItems: 'center', textAlign: 'center', gap: 1.5 }}>
              <Box component="img" src={sinoportLogo} alt="Sinoport" sx={{ height: 40, width: 'auto' }} />
              <Typography variant="h3">{t(language, 'login_title')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t(language, 'login_subtitle')}
              </Typography>
            </Stack>

            <TextField
              select
              label={t(language, 'language')}
              value={language}
              onChange={(event) => {
                const nextLanguage = event.target.value;
                setLanguage(nextLanguage);
                writeMobileLanguage(nextLanguage);
              }}
            >
              {languageOptions.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={t(language, 'operator_name')}
              value={form.operator}
              onChange={(event) => setForm((prev) => ({ ...prev, operator: event.target.value }))}
              placeholder={t(language, 'operator_placeholder')}
            />
            <TextField
              label={t(language, 'employee_id')}
              value={form.employeeId}
              onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
              placeholder={t(language, 'employee_placeholder')}
            />
            <TextField
              select
              label={t(language, 'station')}
              value={form.station}
              onChange={(event) => setForm((prev) => ({ ...prev, station: event.target.value }))}
            >
              {stationOptions.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {localizeMobileText(language, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="large"
              variant="contained"
              disabled={!canSubmit}
              onClick={() => {
                writeMobileSession({
                  operator: form.operator.trim(),
                  employeeId: form.employeeId.trim(),
                  station: stationOptions.find((item) => item.value === form.station)?.label || stationOptions[0].label,
                  language,
                  businessType: '',
                  loginAt: new Date().toISOString()
                });
                navigate('/mobile/select', { replace: true });
              }}
            >
              {t(language, 'login_continue')}
            </Button>
          </Stack>
        </MainCard>
      </Box>
    </Box>
  );
}
