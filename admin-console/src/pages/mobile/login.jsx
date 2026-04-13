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
import { openSnackbar } from 'api/snackbar';
import { mobileLogin } from 'api/station';
import { mobileRoleOptions } from 'data/sinoport-adapters';
import { writeMobileSession } from 'utils/mobile/session';
import { getMobileLanguageOptions, localizeMobileText, readMobileLanguage, t, writeMobileLanguage } from 'utils/mobile/i18n';

const stationOptions = [
  { value: 'mme', code: 'MME', label: 'MME 样板站' },
  { value: 'urc', code: 'URC', label: 'URC 前置站' },
  { value: 'mst', code: 'MST', label: 'MST 分拨站' },
  { value: 'boh', code: 'BOH', label: 'BoH 航站' },
  { value: 'rze', code: 'RZE', label: 'RZE 协同站' }
];

export default function MobileLoginPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(readMobileLanguage());
  const [submitting, setSubmitting] = useState(false);
  const languageOptions = getMobileLanguageOptions(language);
  const [form, setForm] = useState({
    operator: '',
    employeeId: '',
    station: stationOptions[0].value,
    roleKey: mobileRoleOptions[0].value
  });

  const canSubmit = form.operator.trim() && form.employeeId.trim() && form.station && form.roleKey;

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
              name="operator"
              label={t(language, 'operator_name')}
              value={form.operator}
              onChange={(event) => setForm((prev) => ({ ...prev, operator: event.target.value }))}
              placeholder={t(language, 'operator_placeholder')}
            />
            <TextField
              name="employee_id"
              label={t(language, 'employee_id')}
              value={form.employeeId}
              onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
              placeholder={t(language, 'employee_placeholder')}
            />
            <TextField
              name="station"
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
            <TextField
              name="demo_role"
              select
              label={localizeMobileText(language, 'Demo 角色')}
              value={form.roleKey}
              onChange={(event) => setForm((prev) => ({ ...prev, roleKey: event.target.value }))}
            >
              {mobileRoleOptions.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {localizeMobileText(language, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="large"
              variant="contained"
              disabled={!canSubmit || submitting}
              onClick={async () => {
                const selectedRole = mobileRoleOptions.find((item) => item.value === form.roleKey) || mobileRoleOptions[0];
                const station = stationOptions.find((item) => item.value === form.station) || stationOptions[0];

                try {
                  setSubmitting(true);
                  const response = await mobileLogin({
                    operator: form.operator.trim(),
                    employeeId: form.employeeId.trim(),
                    stationCode: station.code,
                    roleKey: selectedRole.value,
                    language
                  });

                  if (response?.data?.token) {
                    localStorage.setItem('serviceToken', response.data.token);
                  }

                  writeMobileSession({
                    operator: form.operator.trim(),
                    employeeId: form.employeeId.trim(),
                    stationCode: station.code,
                    station: station.label,
                    roleKey: selectedRole.value,
                    roleLabel: selectedRole.label,
                    role: selectedRole.label,
                    language,
                    businessType: '',
                    loginAt: new Date().toISOString()
                  });

                  openSnackbar({
                    open: true,
                    message: '移动端登录成功',
                    variant: 'alert',
                    alert: { color: 'success' }
                  });

                  navigate('/mobile/select', { replace: true });
                } catch (error) {
                  openSnackbar({
                    open: true,
                    message: error?.error?.message || '移动端登录失败',
                    variant: 'alert',
                    alert: { color: 'error' }
                  });
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? localizeMobileText(language, '登录中…') : t(language, 'login_continue')}
            </Button>
          </Stack>
        </MainCard>
      </Box>
    </Box>
  );
}
