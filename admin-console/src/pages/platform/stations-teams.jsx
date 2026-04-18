import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  archivePlatformTeam,
  createPlatformTeam,
  updatePlatformTeam,
  useGetPlatformTeamOptions,
  useGetPlatformTeams
} from 'api/platform';

const PAGE_SIZE = 20;
const TEAM_STATUS_TEXT_COLORS = {
  active: 'success.main',
  onboarding: 'info.main',
  paused: 'warning.main',
  archived: 'text.secondary'
};

const EMPTY_FORM = {
  team_id: '',
  station_id: '',
  team_name: '',
  owner_name: '',
  shift_code: '',
  headcount: 0,
  mapped_lanes: '',
  team_status: 'active'
};

function buildFormState(team) {
  if (!team) {
    return EMPTY_FORM;
  }

  return {
    team_id: team.team_id || '',
    station_id: team.station_id || '',
    team_name: team.team_name || '',
    owner_name: team.owner_name || '',
    shift_code: team.shift_code || '',
    headcount: Number(team.headcount || 0),
    mapped_lanes: team.mapped_lanes || '',
    team_status: team.team_status || 'active'
  };
}

export default function PlatformStationsTeamsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { stations, shifts, statuses, teamOptionsLoading } = useGetPlatformTeamOptions();
  const { teamRows, teamPage, teamsError } = useGetPlatformTeams({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    station_id: stationFilter,
    status: statusFilter,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (selectedTeam) {
      const matched = teamRows.find((item) => item.team_id === selectedTeam.team_id);
      if (matched) {
        setSelectedTeam(matched);
        setFormState(buildFormState(matched));
      }
    }
  }, [teamRows, selectedTeam]);

  const tableRows = teamPage?.items || teamRows;
  const total = teamPage?.total || tableRows.length;
  const currentPage = Math.max(0, (teamPage?.page || 1) - 1);
  const isEditMode = Boolean(selectedTeam);
  const shiftLabelMap = useMemo(() => new Map(shifts.map((item) => [item.value, item.label])), [shifts]);
  const statusLabelMap = useMemo(() => new Map(statuses.map((item) => [item.value, item.label])), [statuses]);
  const canSubmit = useMemo(
    () => Boolean(formState.team_id && formState.station_id && formState.team_name && formState.team_status),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setFormState((current) => ({
      ...current,
      [field]:
        field === 'team_id'
          ? String(nextValue).toUpperCase()
          : field === 'headcount'
            ? Number.parseInt(String(nextValue), 10) || 0
            : nextValue
    }));
  };

  const openCreatePanel = () => {
    setSelectedTeam(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (team) => {
    setSelectedTeam(team);
    setFormState(buildFormState(team));
    setFeedback(null);
    setFormOpen(true);
  };

  const resetForm = () => {
    setSelectedTeam(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({ severity: 'error', message: m('请先补齐班组编码、所属站点、班组名称和状态。') });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformTeam(selectedTeam.team_id, formState);
        setSelectedTeam(detail?.team || selectedTeam);
        setFormState(buildFormState(detail?.team || selectedTeam));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `班组 ${selectedTeam.team_id} 已更新。`) });
        setFormOpen(false);
      } else {
        const detail = await createPlatformTeam(formState);
        setSelectedTeam(detail?.team || null);
        setFormState(buildFormState(detail?.team || null));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `创建 班组 ${formState.team_id}`) });
        setFormOpen(false);
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('班组保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (team, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformTeam(team.team_id, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `班组 ${team.team_id} 已恢复。`) });
      } else {
        await archivePlatformTeam(team.team_id);
        if (selectedTeam?.team_id === team.team_id) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `班组 ${team.team_id} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('班组归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Team Mapping"
          title={m('站点班组映射')}
          description={m('班组对象现在直接从团队正式表读取，平台可以维护站点归属、班次、人数、状态和链路映射。')}
          chips={[]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                {m('返回站点总览')}
              </Button>
              <Button component={RouterLink} to="/platform/stations/zones" variant="outlined">
                {m('区位映射')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('班组台账')} subheader={m('班组列表已切到数据库分页；默认每页 20 条。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('班组编码 / 班组名称 / Owner / 链路')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('所属站点')}
                value={stationFilter}
                onChange={(event) => {
                  setStationFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">{m('全部站点')}</MenuItem>
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('状态')}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ ml: { md: 'auto' } }}>
                <Button variant="contained" onClick={openCreatePanel}>
                  {m('新建班组')}
                </Button>
              </Box>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={includeArchived}
                  onChange={(event) => {
                    setIncludeArchived(event.target.checked);
                    setPage(0);
                  }}
                />
              }
              label={m('显示已归档')}
            />

            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            {teamsError ? <Alert severity="error">{m('班组台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('班组编码')}</TableCell>
                  <TableCell>{m('所属站点')}</TableCell>
                  <TableCell>{m('班次')}</TableCell>
                  <TableCell>{m('人数')}</TableCell>
                  <TableCell>{m('链路')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((item) => (
                  <TableRow key={item.team_id} hover selected={selectedTeam?.team_id === item.team_id}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{item.team_id}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {localizeUiText(locale, item.team_name)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{item.station_code}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.station_name)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, shiftLabelMap.get(item.shift_code) || item.shift || '--')}</TableCell>
                    <TableCell>{item.headcount}</TableCell>
                    <TableCell>{localizeUiText(locale, item.mapped_lanes || '--')}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: TEAM_STATUS_TEXT_COLORS[item.archived ? 'archived' : item.team_status] || 'info.main' }}
                      >
                        {localizeUiText(locale, item.archived ? '已归档' : statusLabelMap.get(item.team_status) || item.team_status)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={selectedTeam?.team_id === item.team_id ? 'contained' : 'outlined'}
                          onClick={() => openEditPanel(item)}
                        >
                          {m('编辑')}
                        </Button>
                        <Button
                          size="small"
                          color={item.archived ? 'success' : 'error'}
                          variant="outlined"
                          onClick={() => handleArchiveToggle(item, item.archived)}
                          disabled={submitting}
                        >
                          {item.archived ? m('恢复') : m('归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={total}
              page={currentPage}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <Alert severity="info">{m('当前任务卡只收口平台侧班组 CRUD；站内资源页后续再按同一分页与选项规范推进。')}</Alert>
      </Grid>

      <Drawer anchor="right" open={formOpen} onClose={resetForm}>
        <Box sx={{ width: { xs: '100vw', sm: 440 }, p: 3 }}>
          <MainCard
            title={isEditMode ? localizeUiText(locale, `编辑班组 ${selectedTeam?.team_id}`) : m('新增班组')}
            subheader={m('表单下拉全部来自数据库；创建和更新都会写审计。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField label={m('班组编码')} value={formState.team_id} onChange={handleChange('team_id')} disabled={isEditMode} />
              <TextField
                select
                label={m('所属站点')}
                value={formState.station_id}
                onChange={handleChange('station_id')}
                disabled={teamOptionsLoading}
              >
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={m('班组名称')} value={formState.team_name} onChange={handleChange('team_name')} />
              <TextField label={m('Owner')} value={formState.owner_name} onChange={handleChange('owner_name')} />
              <TextField
                select
                label={m('班次')}
                value={formState.shift_code}
                onChange={handleChange('shift_code')}
                disabled={teamOptionsLoading}
              >
                {shifts.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={m('人数')}
                type="number"
                value={formState.headcount}
                onChange={handleChange('headcount')}
                inputProps={{ min: 0 }}
              />
              <TextField label={m('链路映射')} value={formState.mapped_lanes} onChange={handleChange('mapped_lanes')} multiline minRows={3} />
              <TextField
                select
                label={m('状态')}
                value={formState.team_status}
                onChange={handleChange('team_status')}
                disabled={teamOptionsLoading}
              >
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction="row" sx={{ gap: 1 }}>
                <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || submitting}>
                  {isEditMode ? m('保存班组') : m('创建班组')}
                </Button>
                <Button variant="outlined" onClick={resetForm} disabled={submitting}>
                  {m('取消')}
                </Button>
              </Stack>
            </Stack>
          </MainCard>
        </Box>
      </Drawer>
    </Grid>
  );
}
