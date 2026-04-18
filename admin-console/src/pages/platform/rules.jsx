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
  archivePlatformRule,
  createPlatformRule,
  updatePlatformRule,
  useGetPlatformRuleOptions,
  useGetPlatformRules
} from 'api/platform';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  rule_id: '',
  rule_name: '',
  rule_type: '',
  control_level: '',
  applicability_scope: 'global',
  related_station_id: '',
  related_lane_id: '',
  related_scenario_id: '',
  service_level: '',
  timeline_stage: '',
  rule_status: 'active',
  summary: '',
  trigger_condition: '',
  trigger_node: '',
  action_target: '',
  blocker_action: '',
  recovery_action: '',
  evidence_requirements: '',
  owner_role: '',
  note: ''
};

function buildFormState(rule) {
  if (!rule) {
    return EMPTY_FORM;
  }

  return {
    rule_id: rule.rule_id || rule.code || '',
    rule_name: rule.rule_name || rule.name || '',
    rule_type: rule.rule_type || rule.type_key || '',
    control_level: rule.control_level || '',
    applicability_scope: rule.applicability_scope || rule.scope_key || 'global',
    related_station_id: rule.related_station_id || '',
    related_lane_id: rule.related_lane_id || '',
    related_scenario_id: rule.related_scenario_id || '',
    service_level: rule.service_level || '',
    timeline_stage: rule.timeline_stage || '',
    rule_status: rule.rule_status || 'active',
    summary: rule.summary || '',
    trigger_condition: rule.trigger_condition || '',
    trigger_node: rule.trigger_node || '',
    action_target: rule.action_target || '',
    blocker_action: rule.blocker_action || '',
    recovery_action: rule.recovery_action || '',
    evidence_requirements: rule.evidence_requirements || '',
    owner_role: rule.owner_role || '',
    note: rule.note || ''
  };
}

export default function PlatformRulesPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [controlFilter, setControlFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { stations, lanes, scenarios, types, controlLevels, statuses, scopes, serviceLevels, timelineStages, ruleOptionsLoading } =
    useGetPlatformRuleOptions();
  const { ruleRows, rulePage, ruleTypeSummaryRows, ruleTimelineRows, rulesLoading, rulesError } = useGetPlatformRules({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    type: typeFilter,
    control_level: controlFilter,
    scope: scopeFilter,
    status: statusFilter,
    include_archived: includeArchived
  });

  useEffect(() => {
    if (selectedRule) {
      const matched = ruleRows.find((item) => item.rule_id === selectedRule.rule_id);
      if (matched) {
        setSelectedRule(matched);
        setFormState(buildFormState(matched));
      }
    }
  }, [ruleRows, selectedRule]);

  const tableRows = rulePage?.items || ruleRows;
  const total = rulePage?.total || tableRows.length;
  const currentPage = Math.max(0, (rulePage?.page || 1) - 1);
  const isEditMode = Boolean(selectedRule);
  const targetOptions = useMemo(() => {
    if (formState.applicability_scope === 'station') {
      return stations;
    }

    if (formState.applicability_scope === 'lane') {
      return lanes;
    }

    if (formState.applicability_scope === 'scenario') {
      return scenarios;
    }

    return [];
  }, [formState.applicability_scope, lanes, scenarios, stations]);
  const targetField = useMemo(() => {
    if (formState.applicability_scope === 'station') {
      return {
        key: 'related_station_id',
        label: m('适用站点'),
        placeholder: m('请选择站点')
      };
    }

    if (formState.applicability_scope === 'lane') {
      return {
        key: 'related_lane_id',
        label: m('适用链路'),
        placeholder: m('请选择链路')
      };
    }

    if (formState.applicability_scope === 'scenario') {
      return {
        key: 'related_scenario_id',
        label: m('适用场景'),
        placeholder: m('请选择场景')
      };
    }

    return null;
  }, [formState.applicability_scope, m]);
  const canSubmit = useMemo(() => {
    if (
      !formState.rule_id ||
      !formState.rule_name ||
      !formState.rule_type ||
      !formState.control_level ||
      !formState.applicability_scope ||
      !formState.timeline_stage ||
      !formState.rule_status ||
      !formState.summary
    ) {
      return false;
    }

    if (formState.rule_type === 'service_level' && !formState.service_level) {
      return false;
    }

    if (formState.applicability_scope === 'station' && !formState.related_station_id) {
      return false;
    }

    if (formState.applicability_scope === 'lane' && !formState.related_lane_id) {
      return false;
    }

    if (formState.applicability_scope === 'scenario' && !formState.related_scenario_id) {
      return false;
    }

    return true;
  }, [formState]);

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;

    setFormState((current) => {
      const nextState = {
        ...current,
        [field]: field === 'rule_id' ? String(nextValue).toUpperCase() : nextValue
      };

      if (field === 'applicability_scope') {
        nextState.related_station_id = '';
        nextState.related_lane_id = '';
        nextState.related_scenario_id = '';
      }

      if (field === 'rule_type' && nextValue !== 'service_level') {
        nextState.service_level = '';
      }

      return nextState;
    });
  };

  const openCreatePanel = () => {
    setSelectedRule(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(true);
  };

  const openEditPanel = (rule) => {
    setSelectedRule(rule);
    setFormState(buildFormState(rule));
    setFeedback(null);
    setFormOpen(true);
  };

  const resetForm = () => {
    setSelectedRule(null);
    setFormState(EMPTY_FORM);
    setFeedback(null);
    setFormOpen(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setFeedback({
        severity: 'error',
        message: m('请先补齐规则编码、名称、类型、控制层级、适用范围、时间线阶段、状态和摘要。')
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (isEditMode) {
        const detail = await updatePlatformRule(selectedRule.rule_id, formState);
        setSelectedRule(detail?.rule || selectedRule);
        setFormState(buildFormState(detail?.rule || selectedRule));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `规则 ${selectedRule.rule_id} 已更新。`) });
        setFormOpen(false);
      } else {
        const detail = await createPlatformRule(formState);
        setSelectedRule(detail?.rule || null);
        setFormState(buildFormState(detail?.rule || null));
        setFeedback({ severity: 'success', message: localizeUiText(locale, `创建规则 ${formState.rule_id}`) });
        setFormOpen(false);
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('规则保存失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (rule, archived) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (archived) {
        await updatePlatformRule(rule.rule_id, { archived: false });
        setFeedback({ severity: 'success', message: localizeUiText(locale, `规则 ${rule.rule_id} 已恢复。`) });
      } else {
        await archivePlatformRule(rule.rule_id);
        if (selectedRule?.rule_id === rule.rule_id) {
          resetForm();
        }
        setFeedback({ severity: 'success', message: localizeUiText(locale, `规则 ${rule.rule_id} 已归档。`) });
      }
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('规则归档状态更新失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Rules & Instruction Engine"
          title={m('规则与指令引擎')}
          description={m('规则对象已切到正式表，平台现在直接维护规则类型、控制层级、适用范围、时间线阶段和作用目标，列表/下拉/辅助时间线均来自数据库。')}
          chips={['DB CRUD', 'Rule Timeline DTO', 'Drawer Editor']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/network/scenarios" variant="outlined">
                {m('标准场景')}
              </Button>
              <Button component={RouterLink} to="/platform/network" variant="outlined">
                {m('网络总览')}
              </Button>
              <Button component={RouterLink} to="/platform/audit" variant="outlined">
                {m('审计与可信留痕')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('规则台账')} subheader={m('规则列表已切到数据库分页；默认每页 20 条，筛选与表单下拉全部来自后端 options 接口。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2, alignItems: { lg: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('规则编码 / 名称 / 摘要 / 触发条件 / 关联对象')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('规则类型')}
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部类型')}</MenuItem>
                {types.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('控制层级')}
                value={controlFilter}
                onChange={(event) => {
                  setControlFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部层级')}</MenuItem>
                {controlLevels.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('适用范围')}
                value={scopeFilter}
                onChange={(event) => {
                  setScopeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">{m('全部范围')}</MenuItem>
                {scopes.map((option) => (
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
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ ml: { lg: 'auto' } }}>
                <Button variant="contained" onClick={openCreatePanel}>
                  {m('新建规则')}
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
            {rulesError ? <Alert severity="error">{m('规则台账加载失败，请检查后端连接。')}</Alert> : null}
            {ruleOptionsLoading ? <Alert severity="info">{m('正在从数据库加载规则下拉选项…')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('规则编码')}</TableCell>
                  <TableCell>{m('规则名称')}</TableCell>
                  <TableCell>{m('类型')}</TableCell>
                  <TableCell>{m('控制层级')}</TableCell>
                  <TableCell>{m('适用范围')}</TableCell>
                  <TableCell>{m('关联对象')}</TableCell>
                  <TableCell>{m('时间线阶段')}</TableCell>
                  <TableCell>{m('状态')}</TableCell>
                  <TableCell>{m('更新时间')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((rule) => (
                  <TableRow key={rule.rule_id} hover selected={selectedRule?.rule_id === rule.rule_id}>
                    <TableCell>
                      <Typography variant="subtitle2">{rule.rule_id}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 240 }}>
                      <Stack sx={{ gap: 0.5 }}>
                        <Typography variant="subtitle2">{localizeUiText(locale, rule.rule_name)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, rule.summary)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, rule.type)}</TableCell>
                    <TableCell>{localizeUiText(locale, rule.control)}</TableCell>
                    <TableCell>{localizeUiText(locale, rule.scope)}</TableCell>
                    <TableCell>{localizeUiText(locale, rule.target)}</TableCell>
                    <TableCell>{localizeUiText(locale, rule.timeline)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, rule.status)} />
                    </TableCell>
                    <TableCell>{rule.updated_at ? String(rule.updated_at).replace('T', ' ').slice(0, 16) : '--'}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                        <Button size="small" variant="text" onClick={() => openEditPanel(rule)}>
                          {m('编辑')}
                        </Button>
                        <Button
                          size="small"
                          color={rule.archived ? 'success' : 'warning'}
                          onClick={() => handleArchiveToggle(rule, rule.archived)}
                          disabled={submitting}
                        >
                          {rule.archived ? m('恢复') : m('归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!rulesLoading && !tableRows.length ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前筛选条件下没有规则记录。')}
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

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title={m('规则类型概览')} subheader={m('来自正式表的聚合 DTO。')}>
          <Stack sx={{ gap: 1.5 }}>
            {ruleTypeSummaryRows.map((item) => (
              <Stack key={item.type_key} direction="row" justifyContent="space-between" sx={{ gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2">{localizeUiText(locale, item.type)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {m('控制层级：')}{localizeUiText(locale, item.controls || '--')}
                  </Typography>
                </Box>
                <Typography variant="h6">{item.count}</Typography>
              </Stack>
            ))}
            {!ruleTypeSummaryRows.length ? (
              <Typography variant="body2" color="text.secondary">
                {m('暂无规则类型统计。')}
              </Typography>
            ) : null}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <MainCard title={m('规则时间线')} subheader={m('主读源为正式规则表聚合，不再使用 scenarioTimelineRows。')}>
          <Stack sx={{ gap: 1.5 }}>
            {ruleTimelineRows.map((item) => (
              <Stack key={item.stage_key} direction="row" justifyContent="space-between" sx={{ gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2">{localizeUiText(locale, item.stage)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {localizeUiText(locale, item.rules)}
                  </Typography>
                </Box>
                <Typography variant="h6">{item.count}</Typography>
              </Stack>
            ))}
            {!ruleTimelineRows.length ? (
              <Typography variant="body2" color="text.secondary">
                {m('暂无时间线聚合数据。')}
              </Typography>
            ) : null}
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={formOpen} onClose={resetForm}>
        <Box sx={{ width: { xs: 360, sm: 520 }, p: 3 }}>
          <Stack sx={{ gap: 2.5 }}>
            <Box>
              <Typography variant="h4">{isEditMode ? localizeUiText(locale, `编辑规则 ${selectedRule?.rule_id}`) : m('新建规则')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {m('规则表单字段全部写入正式 `platform_rules` 表，业务下拉均来自数据库选项源。')}
              </Typography>
            </Box>

            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}

            <TextField
              label={m('规则编码')}
              value={formState.rule_id}
              onChange={handleChange('rule_id')}
              disabled={isEditMode}
              helperText={m('建议使用全大写编码，例如 RULE-GATE-001。')}
              fullWidth
            />
            <TextField label={m('规则名称')} value={formState.rule_name} onChange={handleChange('rule_name')} fullWidth />

            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
              <TextField select label={m('规则类型')} value={formState.rule_type} onChange={handleChange('rule_type')} fullWidth>
                {types.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('控制层级')}
                value={formState.control_level}
                onChange={handleChange('control_level')}
                fullWidth
              >
                {controlLevels.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
              <TextField
                select
                label={m('适用范围')}
                value={formState.applicability_scope}
                onChange={handleChange('applicability_scope')}
                fullWidth
              >
                {scopes.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('时间线阶段')}
                value={formState.timeline_stage}
                onChange={handleChange('timeline_stage')}
                fullWidth
              >
                {timelineStages.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {targetField ? (
              <TextField
                select
                label={targetField.label}
                value={formState[targetField.key]}
                onChange={handleChange(targetField.key)}
                helperText={targetField.placeholder}
                fullWidth
              >
                {targetOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
              <TextField
                select
                label={m('服务等级')}
                value={formState.service_level}
                onChange={handleChange('service_level')}
                helperText={formState.rule_type === 'service_level' ? m('服务等级规则必填。') : m('非服务等级规则可留空。')}
                fullWidth
              >
                <MenuItem value="">{m('无')}</MenuItem>
                {serviceLevels.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label={m('状态')} value={formState.rule_status} onChange={handleChange('rule_status')} fullWidth>
                {statuses.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField label={m('规则摘要')} value={formState.summary} onChange={handleChange('summary')} multiline minRows={2} fullWidth />
            <TextField
              label={m('触发条件')}
              value={formState.trigger_condition}
              onChange={handleChange('trigger_condition')}
              multiline
              minRows={2}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
              <TextField label={m('触发节点')} value={formState.trigger_node} onChange={handleChange('trigger_node')} fullWidth />
              <TextField label={m('作用对象')} value={formState.action_target} onChange={handleChange('action_target')} fullWidth />
            </Stack>
            <TextField
              label={m('阻断动作')}
              value={formState.blocker_action}
              onChange={handleChange('blocker_action')}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label={m('恢复动作')}
              value={formState.recovery_action}
              onChange={handleChange('recovery_action')}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label={m('证据要求')}
              value={formState.evidence_requirements}
              onChange={handleChange('evidence_requirements')}
              multiline
              minRows={2}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2 }}>
              <TextField label={m('Owner 角色')} value={formState.owner_role} onChange={handleChange('owner_role')} fullWidth />
              <TextField label={m('备注')} value={formState.note} onChange={handleChange('note')} fullWidth />
            </Stack>

            <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1.5 }}>
              <Button variant="text" onClick={resetForm}>
                {m('取消')}
              </Button>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                {isEditMode ? m('保存更新') : m('创建规则')}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </Grid>
  );
}
