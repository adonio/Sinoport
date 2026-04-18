import { useEffect, useState } from 'react';
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
import { fetchMobileLoginOptions, mobileLogin } from 'api/station';
import useConfig from 'hooks/useConfig';
import { normalizeAppLanguage } from 'utils/app-i18n';
import { writeMobileSession } from 'utils/mobile/session';
import { getMobileLanguageOptions, localizeMobileText, readMobileLanguage, t, writeMobileLanguage } from 'utils/mobile/i18n';
import { isTestStationEnvironment, TEST_DEFAULT_STATION_CREDENTIALS } from 'utils/stationApi';

function normalizeOptions(value) {
  return Array.isArray(value) ? value : [];
}

const defaultCredentials = isTestStationEnvironment()
  ? TEST_DEFAULT_STATION_CREDENTIALS
  : { email: '', password: '' };

export default function MobileLoginPage() {
  const navigate = useNavigate();
  const { state, setField } = useConfig();
  const [language, setLanguage] = useState(normalizeAppLanguage(state.i18n || readMobileLanguage()));
  const [submitting, setSubmitting] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [loginOptions, setLoginOptions] = useState({
    stationOptions: [],
    roleOptions: [],
    requiresFormalAuth: false
  });
  const [form, setForm] = useState({
    operator: '',
    employeeId: '',
    email: defaultCredentials.email,
    password: defaultCredentials.password,
    station: '',
    roleKey: ''
  });
  const languageOptions = getMobileLanguageOptions(language);

  useEffect(() => {
    setLanguage(normalizeAppLanguage(state.i18n || readMobileLanguage()));
  }, [state.i18n]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetchMobileLoginOptions();
        if (!active) return;

        const data = response?.data || {};
        const stationOptions = normalizeOptions(data.station_options);
        const roleOptions = normalizeOptions(data.role_options);
        const defaults = data.defaults || {};
        const requiresFormalAuth = Boolean(data.requires_formal_auth);

        setLoginOptions({ stationOptions, roleOptions, requiresFormalAuth });
        setForm((prev) => ({
          ...prev,
          station: prev.station || defaults.station || stationOptions[0]?.value || '',
          roleKey: prev.roleKey || defaults.role_key || roleOptions[0]?.value || ''
        }));
        setOptionsError('');
        } catch {
        if (active) {
          setOptionsError('登录选项加载失败');
        }
      } finally {
        if (active) {
          setOptionsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const selectedStation = loginOptions.stationOptions.find((item) => item.value === form.station) || loginOptions.stationOptions[0];
  const selectedRole = loginOptions.roleOptions.find((item) => item.value === form.roleKey) || loginOptions.roleOptions[0];
  const requiresFormalAuth = Boolean(loginOptions.requiresFormalAuth);
  const canSubmit = !optionsLoading && Boolean(form.station) && Boolean(form.roleKey) && (
    requiresFormalAuth
      ? Boolean(form.email.trim()) && Boolean(form.password)
      : Boolean(form.operator.trim()) && Boolean(form.employeeId.trim())
  );
  const loadingLabel = localizeMobileText(language, '登录中…');

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
                setField('i18n', nextLanguage);
                writeMobileLanguage(nextLanguage);
              }}
            >
              {languageOptions.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>

            {requiresFormalAuth ? (
              <>
                <TextField
                  name="email"
                  label={t(language, 'email')}
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="operator@sinoport.co"
                />
                <TextField
                  name="password"
                  label={t(language, 'password')}
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder={t(language, 'password')}
                />
              </>
            ) : (
              <>
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
              </>
            )}
            <TextField
              name="station"
              select
              label={t(language, 'station')}
              value={form.station}
              disabled={optionsLoading || !loginOptions.stationOptions.length}
              onChange={(event) => setForm((prev) => ({ ...prev, station: event.target.value }))}
              helperText={optionsError ? localizeMobileText(language, optionsError) : undefined}
            >
              {optionsLoading ? (
                <MenuItem value="" disabled>
                  {t(language, 'login_subtitle')}
                </MenuItem>
              ) : (
                loginOptions.stationOptions.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {localizeMobileText(language, item.label)}
                  </MenuItem>
                ))
              )}
            </TextField>
            <TextField
              name="demo_role"
              select
              label={localizeMobileText(language, '角色')}
              value={form.roleKey}
              disabled={optionsLoading || !loginOptions.roleOptions.length}
              onChange={(event) => setForm((prev) => ({ ...prev, roleKey: event.target.value }))}
            >
              {optionsLoading ? (
                <MenuItem value="" disabled>
                  {loadingLabel}
                </MenuItem>
              ) : (
                loginOptions.roleOptions.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {localizeMobileText(language, item.label)}
                  </MenuItem>
                ))
              )}
            </TextField>
            <Button
              size="large"
              variant="contained"
              disabled={!canSubmit || submitting}
              onClick={async () => {
                const station = selectedStation || loginOptions.stationOptions[0];
                const role = selectedRole || loginOptions.roleOptions[0];

                try {
                  setSubmitting(true);
                  const response = await mobileLogin({
                    operator: form.operator.trim(),
                    employeeId: form.employeeId.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    stationCode: station.code,
                    roleKey: role.value,
                    language
                  });

                  if (response?.data?.token) {
                    localStorage.setItem('serviceToken', response.data.token);
                  }

                  writeMobileSession({
                    operator: form.operator.trim() || response?.data?.user?.display_name || form.email.trim(),
                    employeeId: form.employeeId.trim() || response?.data?.user?.user_id || '',
                    stationCode: station.code,
                    station: station.label,
                    roleKey: role.value,
                    roleLabel: role.label,
                    role: role.label,
                    language,
                    businessType: '',
                    loginAt: new Date().toISOString()
                  });

                  openSnackbar({
                    open: true,
                    message: localizeMobileText(language, '移动端登录成功'),
                    variant: 'alert',
                    alert: { color: 'success' }
                  });

                  navigate('/mobile/select', { replace: true });
                } catch (error) {
                  openSnackbar({
                    open: true,
                    message: error?.error?.message || localizeMobileText(language, '移动端登录失败'),
                    variant: 'alert',
                    alert: { color: 'error' }
                  });
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? loadingLabel : t(language, 'login_continue')}
            </Button>
          </Stack>
        </MainCard>
      </Box>
    </Box>
  );
}
