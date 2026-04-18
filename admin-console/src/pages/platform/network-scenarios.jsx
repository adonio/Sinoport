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
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  archivePlatformNetworkScenario,
  createPlatformNetworkScenario,
  updatePlatformNetworkScenario,
  useGetPlatformNetworkScenarioOptions,
  useGetPlatformNetworkScenarios
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  scenario_id: '',
  scenario_title: '',
  scenario_category: '',
  lane_id: '',
  primary_station_id: '',
  node_sequence: '',
  entry_rule_summary: '',
  evidence_requirements: '',
  scenario_status: 'active',
  note: ''
};

function buildFormState(scenario) {
  if (!scenario) {
    return EMPTY_FORM;
  }

  return {
    scenario_id: scenario.scenario_id || scenario.id || '',
    scenario_title: scenario.scenario_title || scenario.title || '',
    scenario_category: scenario.scenario_category || scenario.category_key || '',
    lane_id: scenario.lane_id || scenario.lane_code || '',
    primary_station_id: scenario.primary_station_id || '',
    node_sequence: scenario.node_sequence || scenario.nodes || '',
    entry_rule_summary: scenario.entry_rule_summary || scenario.entryRule || '',
    evidence_requirements: scenario.evidence_requirements || scenario.evidence || '',
    scenario_status: scenario.scenario_status || scenario.scenarioStatus || 'active',
    note: scenario.note || ''
  };
}

export default function PlatformNetworkScenariosPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [laneFilter, setLaneFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { stations, lanes, categories, statuses, networkScenarioOptionsLoading } = useGetPlatformNetworkScenarioOptions();
  const { scenarioRows, scenarioPage, networkScenariosLoading, networkScenariosError } = useGetPlatformNetworkScenarios({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    lane_id: laneFilter,
    station_id: stationFilter,
    category: categoryFilter,
    status: statusFilter,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (selectedScenario) {
      const matched = scenarioRows.find((item) => item.scenario_id === selectedScenario.scenario_id);
      if (matched) {
        setSelectedScenario(matched);
        setFormState(buildFormState(matched));
      }
    }
  }, [selectedScenario, scenarioRows]);

  const tableRows = scenarioPage?.items || scenarioRows;
  const total = scenarioPage?.total || tableRows.length;
  const currentPage = Math.max(0, (scenarioPage?.page || 1) - 1);
  const categoryLabelMap = useMemo(() => new Map(categories.map((item) => [item.value, item.label])), [categories]);
  const statusLabelMap = useMemo(() => new Map(statuses.map((item) => [item.value, item.label])), [statuses]);
  const isEditMode = Boolean(selectedScenario);
  const canSubmit = useMemo(
    () =>
      Boolean(
        formState.scenario_id &&
          formState.scenario_title &&
          formState.scenario_category &&
          formState.lane_id &&
          formState.primary_station_id &&
          formState.node_sequence &&
          formState.entry_rule_summary &&
          formState.evidence_requirements &&
          formState.scenario_status
      ),
    [formState]
  );

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setFormState((current) => ({
      ...current,
      [field]: field === 'scenario_id' ? String(nextValue).toUpperCase() : nextValue
    }));
  };

  const openCreatePanel = () => {
    setSelectedScenario(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (scenario) => {
    setSelectedScenario(scenario);
    setFormState(buildFormState(scenario));
    setFeedback(null);
    setFormOpen(true);
  };

  const resetForm = () => {
    setSelectedScenario(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({
        severity: 'error',
        message: m('请先补齐场景编码、名称、分类、链路、主站点、节点、进入规则、证据要求和状态。')
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformNetworkScenario(selectedScenario.scenario_id, formState);
        setSelectedScenario(detail?.scenario || selectedScenario);
        setFormState(buildFormState(detail?.scenario || selectedScenario));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `场景 ${selectedScenario.scenario_id} 已更新。`) });
        setFormOpen(false);
      } else {
        const detail = await createPlatformNetworkScenario(formState);
        setSelectedScenario(detail?.scenario || null);
        setFormState(buildFormState(detail?.scenario || null));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `创建场景 ${formState.scenario_id}`) });
        setFormOpen(false);
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('场景保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (scenario, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformNetworkScenario(scenario.scenario_id, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `场景 ${scenario.scenario_id} 已恢复。`) });
      } else {
        await archivePlatformNetworkScenario(scenario.scenario_id);
        if (selectedScenario?.scenario_id === scenario.scenario_id) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `场景 ${scenario.scenario_id} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('场景归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Network Scenarios"
          title={m('标准场景模板')}
          description={m('场景对象已切到正式表，平台可以直接维护场景分类、链路归属、主站点、进入规则和证据链。')}
          chips={['DB CRUD', 'Scenario Template', 'Drawer Editor']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network" variant="outlined">
                {m('返回网络总览')}
              </Button>
              <Button component={RouterLink} to="/platform/rules" variant="outlined">
                {m('规则与指令引擎')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('场景台账')} subheader={m('场景列表已切到数据库分页；默认每页 20 条，筛选和表单下拉均来自后端 options 接口。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, alignItems: { md: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('场景编码 / 名称 / 节点 / 规则 / 证据 / 链路')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('链路')}
                value={laneFilter}
                onChange={(event) => {
                  setLaneFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 240 }}
              >
                <MenuItem value="">{m('全部链路')}</MenuItem>
                {lanes.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('主站点')}
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
                label={m('分类')}
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部分类')}</MenuItem>
                {categories.map((option) => (
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
                  {m('新建场景')}
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
            {networkScenariosError ? <Alert severity="error">{m('场景台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('场景编码')}</TableCell>
                  <TableCell>{m('场景')}</TableCell>
                  <TableCell>{m('链路 / 主站点')}</TableCell>
                  <TableCell>{m('节点与规则')}</TableCell>
                  <TableCell>{m('证据链')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((item) => (
                  <TableRow key={item.scenario_id} hover selected={selectedScenario?.scenario_id === item.scenario_id}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{item.scenario_id}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, categoryLabelMap.get(item.scenario_category) || item.category)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{localizeUiText(locale, item.scenario_title || item.title)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.note || m('未配置备注'))}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{localizeUiText(locale, item.lane)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.primary_station_id} · {localizeUiText(locale, item.primary_station_name || '--')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{localizeUiText(locale, item.entry_rule_summary || item.entryRule)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.node_sequence || item.nodes)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2">{localizeUiText(locale, item.evidence_requirements || item.evidence)}</Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        label={localizeUiText(locale, item.archived ? '已归档' : statusLabelMap.get(item.scenario_status) || item.status || item.scenario_status)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={selectedScenario?.scenario_id === item.scenario_id ? 'contained' : 'outlined'}
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
                {!tableRows.length && !networkScenariosLoading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前条件下没有场景数据。')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
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

      <Drawer anchor="right" open={formOpen} onClose={resetForm}>
        <Box sx={{ width: { xs: '100vw', sm: 520 }, p: 3 }}>
          <MainCard
            title={isEditMode ? localizeUiText(locale, `编辑场景 ${selectedScenario?.scenario_id}`) : m('新增场景')}
            subheader={m('链路、主站点、分类和状态全部来自数据库选项源；创建和更新都会写审计。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField label={m('场景编码')} value={formState.scenario_id} onChange={handleChange('scenario_id')} disabled={isEditMode} />
              <TextField label={m('场景名称')} value={formState.scenario_title} onChange={handleChange('scenario_title')} />
              <TextField
                select
                label={m('场景分类')}
                value={formState.scenario_category}
                onChange={handleChange('scenario_category')}
                disabled={networkScenarioOptionsLoading}
              >
                <MenuItem value="">{m('请选择分类')}</MenuItem>
                {categories.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('关联链路')}
                value={formState.lane_id}
                onChange={handleChange('lane_id')}
                disabled={networkScenarioOptionsLoading}
              >
                <MenuItem value="">{m('请选择链路')}</MenuItem>
                {lanes.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('主站点')}
                value={formState.primary_station_id}
                onChange={handleChange('primary_station_id')}
                disabled={networkScenarioOptionsLoading}
              >
                <MenuItem value="">{m('请选择主站点')}</MenuItem>
                {stations.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={m('节点序列')} value={formState.node_sequence} onChange={handleChange('node_sequence')} multiline minRows={3} />
              <TextField
                label={m('进入规则')}
                value={formState.entry_rule_summary}
                onChange={handleChange('entry_rule_summary')}
                multiline
                minRows={3}
              />
              <TextField
                label={m('证据要求')}
                value={formState.evidence_requirements}
                onChange={handleChange('evidence_requirements')}
                multiline
                minRows={3}
              />
              <TextField
                select
                label={m('状态')}
                value={formState.scenario_status}
                onChange={handleChange('scenario_status')}
                disabled={networkScenarioOptionsLoading}
              >
                <MenuItem value="">{m('请选择状态')}</MenuItem>
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={m('备注')} value={formState.note} onChange={handleChange('note')} multiline minRows={3} />

              <Stack direction="row" sx={{ gap: 1 }}>
                <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit || submitting}>
                  {isEditMode ? m('保存场景') : m('创建场景')}
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
