import { useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import {
  createStationUser,
  resetStationUserPassword,
  updateStationUser,
  useGetStationUserOptions,
  useGetStationUsers
} from 'api/station';
import { useIntl } from 'react-intl';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

const EMPTY_FORM = {
  display_name: '',
  login_name: '',
  employee_no: '',
  password: '',
  account_status: 'active',
  must_change_password: true,
  roles: []
};

function buildForm(user) {
  if (!user) return { ...EMPTY_FORM };
  return {
    display_name: user.display_name || '',
    login_name: user.login_name || '',
    employee_no: user.employee_no || '',
    password: '',
    account_status: user.account_status || 'active',
    must_change_password: Boolean(user.must_change_password),
    roles: Array.isArray(user.roles) ? user.roles : []
  };
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { hour12: false });
}

function statusColor(status) {
  if (status === 'active') return 'success';
  if (status === 'locked') return 'warning';
  return 'default';
}

export default function StationUsersPage() {
  const intl = useIntl();
  const t = (value) => formatLocalizedMessage(intl, value);
  const l = (value) => localizeUiText(intl.locale, value);
  const { stationUsers, stationUsersStationId, stationUsersLoading, stationUsersError } = useGetStationUsers();
  const { stationUserRoleOptions, stationUserStatusOptions, stationUserOptionsLoading } = useGetStationUserOptions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordUser, setPasswordUser] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const roleLabelMap = useMemo(
    () => new Map(stationUserRoleOptions.map((option) => [option.value, l(option.label)])),
    [stationUserRoleOptions, intl.locale]
  );
  const statusLabelMap = useMemo(
    () => new Map(stationUserStatusOptions.map((option) => [option.value, l(option.label)])),
    [stationUserStatusOptions, intl.locale]
  );
  const isEdit = Boolean(selectedUser);
  const canSave = Boolean(
    form.display_name.trim() && form.login_name.trim() && form.roles.length && (isEdit || form.password.length >= 10)
  );

  const openCreate = () => {
    setSelectedUser(null);
    setForm({ ...EMPTY_FORM, roles: stationUserRoleOptions[0]?.value ? [stationUserRoleOptions[0].value] : [] });
    setFeedback(null);
    setDialogOpen(true);
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setForm(buildForm(user));
    setFeedback(null);
    setDialogOpen(true);
  };

  const handleField = (field) => (event) => {
    const value = field === 'must_change_password' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleRole = (role) => (event) => {
    setForm((current) => ({
      ...current,
      roles: event.target.checked ? [...new Set([...current.roles, role])] : current.roles.filter((item) => item !== role)
    }));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        display_name: form.display_name.trim(),
        login_name: form.login_name.trim().toLowerCase(),
        email: form.login_name.trim().toLowerCase(),
        employee_no: form.employee_no.trim(),
        roles: form.roles,
        account_status: form.account_status,
        must_change_password: form.must_change_password
      };
      if (isEdit) {
        await updateStationUser(selectedUser.user_id, payload);
      } else {
        await createStationUser({ ...payload, password: form.password });
      }
      setDialogOpen(false);
      setFeedback({ severity: 'success', message: t('用户保存成功。') });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || t('操作失败，请检查权限和输入。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (user) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await updateStationUser(user.user_id, {
        display_name: user.display_name,
        email: user.email || user.login_name,
        employee_no: user.employee_no,
        roles: user.roles,
        account_status: user.account_status === 'active' ? 'disabled' : 'active',
        must_change_password: Boolean(user.must_change_password)
      });
      setFeedback({ severity: 'success', message: t('用户保存成功。') });
    } catch (error) {
      setFeedback({ severity: 'error', message: error?.response?.data?.error?.message || t('操作失败，请检查权限和输入。') });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!passwordUser || temporaryPassword.length < 10) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await resetStationUserPassword(passwordUser.user_id, temporaryPassword);
      setPasswordUser(null);
      setTemporaryPassword('');
      setFeedback({ severity: 'success', message: t('密码已重置。') });
    } catch (error) {
      setFeedback({ severity: 'error', message: error?.response?.data?.error?.message || t('操作失败，请检查权限和输入。') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={stationUsersStationId || t('货站账号')}
          title={t('货站用户与权限')}
          description={t('管理本站账号、登录状态、角色和密码重置。')}
          chips={[t('本站隔离'), t('角色权限'), t('登录安全')]}
          action={
            <Button variant="contained" onClick={openCreate} disabled={stationUserOptionsLoading}>
              {t('新建用户')}
            </Button>
          }
        />
      </Grid>

      <Grid size={12}>
        {feedback && <Alert severity={feedback.severity} sx={{ mb: 2 }}>{feedback.message}</Alert>}
        {stationUsersError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {stationUsersError?.response?.status === 403 ? t('只有货站管理员可以管理本站用户。') : t('用户列表加载失败。')}
          </Alert>
        )}
        <MainCard title={t('本站用户')} subheader={t('账号只能登录所属货站，停用和密码重置会撤销已有登录会话。')}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('用户')}</TableCell>
                  <TableCell>{t('登录名')}</TableCell>
                  <TableCell>{t('员工编号')}</TableCell>
                  <TableCell>{t('角色')}</TableCell>
                  <TableCell>{t('状态')}</TableCell>
                  <TableCell>{t('最后登录')}</TableCell>
                  <TableCell align="right">{t('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!stationUsersLoading && !stationUsers.length && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">{t('当前货站还没有用户。')}</TableCell>
                  </TableRow>
                )}
                {stationUsers.map((user) => (
                  <TableRow key={user.user_id} hover>
                    <TableCell>
                      <Stack sx={{ gap: 0.25 }}>
                        <Typography variant="subtitle2">{user.display_name}</Typography>
                        {Boolean(user.must_change_password) && (
                          <Typography variant="caption" color="warning.main">{t('待修改初始密码')}</Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{user.login_name}</TableCell>
                    <TableCell>{user.employee_no || '--'}</TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                        {(user.roles || []).map((role) => <Chip key={role} size="small" label={roleLabelMap.get(role) || role} />)}
                        {(user.protected_roles || []).map((role) => <Chip key={role} size="small" color="info" variant="outlined" label={`${role} · ${t('平台角色')}`} />)}
                      </Stack>
                    </TableCell>
                    <TableCell><Chip size="small" color={statusColor(user.account_status)} label={statusLabelMap.get(user.account_status) || user.account_status} /></TableCell>
                    <TableCell>{formatDateTime(user.last_login_at)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Button size="small" onClick={() => openEdit(user)}>{t('编辑')}</Button>
                        <Button size="small" onClick={() => { setPasswordUser(user); setTemporaryPassword(''); }}>{t('重置密码')}</Button>
                        <Button size="small" color={user.account_status === 'active' ? 'error' : 'success'} disabled={submitting} onClick={() => handleStatusToggle(user)}>
                          {user.account_status === 'active' ? t('停用') : t('启用')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => !submitting && setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{isEdit ? t('编辑货站用户') : t('新建货站用户')}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.25 }}>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth required label={t('姓名')} value={form.display_name} onChange={handleField('display_name')} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth required type="email" disabled={isEdit} label={t('登录名')} value={form.login_name} onChange={handleField('login_name')} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label={t('员工编号')} value={form.employee_no} onChange={handleField('employee_no')} /></Grid>
            {!isEdit && (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth required type="password" label={t('初始密码')} helperText={t('至少 10 位字符')} value={form.password} onChange={handleField('password')} />
              </Grid>
            )}
            {isEdit && (
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField select fullWidth label={t('状态')} value={form.account_status} onChange={handleField('account_status')}>
                  {stationUserStatusOptions.map((option) => <MenuItem key={option.value} value={option.value}>{l(option.label)}</MenuItem>)}
                </TextField>
              </Grid>
            )}
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('角色')}</Typography>
              <FormGroup row>
                {stationUserRoleOptions.map((option) => (
                  <FormControlLabel key={option.value} control={<Checkbox checked={form.roles.includes(option.value)} onChange={handleRole(option.value)} />} label={l(option.label)} />
                ))}
              </FormGroup>
            </Grid>
            <Grid size={12}>
              <FormControlLabel control={<Checkbox checked={form.must_change_password} onChange={handleField('must_change_password')} />} label={t('首次登录必须修改密码')} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>{t('取消')}</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canSave || submitting}>{isEdit ? t('保存') : t('创建')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onClose={() => !submitting && setPasswordUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('重置密码')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField fullWidth type="password" label={t('临时密码')} helperText={t('密码重置后用户必须在下次登录时修改。')} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordUser(null)} disabled={submitting}>{t('取消')}</Button>
          <Button variant="contained" onClick={handlePasswordReset} disabled={temporaryPassword.length < 10 || submitting}>{t('重置密码')}</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
