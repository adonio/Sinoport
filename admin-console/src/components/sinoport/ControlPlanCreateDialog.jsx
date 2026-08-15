import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import { createV14ControlPlan, createV14ControlPlanFlightDraft, useV14Resource, v14Endpoints } from 'api/v14';
import StatusChip from 'components/sinoport/StatusChip';
import { localizeUiText } from 'utils/app-i18n';

const V2_ROUTE = 'SZX_ALASHANKOU_DOSTYK_TAS_LGG_V2';

function tashkentLocalDateTime(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const tashkentTime = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  tashkentTime.setUTCMinutes(0, 0, 0);
  return tashkentTime.toISOString().slice(0, 16);
}

function tashkentIso(value) {
  if (!value) return '';
  return `${value.length === 16 ? value : value.slice(0, 16)}:00+05:00`;
}

function initialForm() {
  const baseline = tashkentLocalDateTime();
  return {
    flightMode: 'new',
    existingFlightId: '',
    flightNo: '',
    aircraftType: 'B744F',
    routeTemplateCode: V2_ROUTE,
    baselineEtd: baseline,
    currentOperatingEtd: baseline,
    flightTimezone: 'Asia/Tashkent',
    projectCode: 'SINOport-V14-PILOT',
    productionMode: false
  };
}

export default function ControlPlanCreateDialog({ open, onClose, onCreated }) {
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);
  const options = useV14Resource(open ? v14Endpoints.controlPlanOptions : null);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const routes = options.data?.routes || [];
  const flights = options.data?.flights || [];
  const selectedRoute = routes.find((item) => item.route_template_code === form.routeTemplateCode);
  const productionAllowed = selectedRoute?.status === 'PUBLISHED' && selectedRoute?.schedule_approval_status === 'APPROVED_FOR_PRODUCTION';
  const selectableFlights = flights.filter((item) => !item.operation_control_plan_id);
  const isComplete = Boolean(
    form.routeTemplateCode &&
    form.baselineEtd &&
    form.currentOperatingEtd &&
    (form.flightMode === 'new' ? form.flightNo.trim() : form.existingFlightId)
  );

  useEffect(() => {
    if (!open) return;
    setForm(initialForm());
    setFeedback(null);
  }, [open]);

  useEffect(() => {
    if (!open || !options.data?.defaults) return;
    setForm((current) => ({
      ...current,
      routeTemplateCode: options.data.defaults.route_template_code || current.routeTemplateCode,
      flightTimezone: options.data.defaults.flight_timezone || current.flightTimezone,
      projectCode: options.data.defaults.project_code || current.projectCode
    }));
  }, [open, options.data]);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => {
      if (key === 'baselineEtd') {
        return {
          ...current,
          baselineEtd: value,
          currentOperatingEtd:
            !current.currentOperatingEtd || current.currentOperatingEtd === current.baselineEtd ? value : current.currentOperatingEtd
        };
      }
      return { ...current, [key]: value };
    });
  };

  const selectExistingFlight = (event) => {
    const flightId = event.target.value;
    const flight = selectableFlights.find((item) => item.flight_id === flightId);
    const baseline = tashkentLocalDateTime(flight?.std_at || flight?.etd_at);
    const current = tashkentLocalDateTime(flight?.etd_at || flight?.std_at);
    setForm((value) => ({
      ...value,
      existingFlightId: flightId,
      baselineEtd: baseline || value.baselineEtd,
      currentOperatingEtd: current || baseline || value.currentOperatingEtd
    }));
  };

  const submit = async () => {
    if (!isComplete || busy) return;
    setBusy(true);
    setFeedback(null);
    let flightId = form.existingFlightId;
    let createdFlightId = '';
    try {
      const baselineEtd = tashkentIso(form.baselineEtd);
      const currentOperatingEtd = tashkentIso(form.currentOperatingEtd);
      if (form.flightMode === 'new') {
        const flightResult = await createV14ControlPlanFlightDraft(
          {
            flight_no: form.flightNo.trim().toUpperCase(),
            flight_date: form.baselineEtd.slice(0, 10),
            baseline_etd: baselineEtd,
            current_operating_etd: currentOperatingEtd,
            aircraft_type: form.aircraftType.trim() || undefined
          },
          `occ-flight-wizard-${crypto.randomUUID()}`
        );
        flightId = flightResult.flight?.flight_id;
        createdFlightId = flightId;
      }
      if (!flightId) throw new Error(l('航班创建成功，但未返回 Flight ID。'));

      const result = await createV14ControlPlan(
        {
          flight_id: flightId,
          route_template_code: form.routeTemplateCode,
          baseline_etd: baselineEtd,
          current_operating_etd: currentOperatingEtd,
          flight_timezone: form.flightTimezone,
          project_code: form.projectCode.trim() || undefined,
          production_mode: form.productionMode,
          source_approval_status: selectedRoute?.schedule_approval_status
        },
        `occ-plan-wizard-${crypto.randomUUID()}`
      );
      onCreated?.({
        planId: result.operation_control_plan_id,
        flightId,
        flightNo:
          form.flightMode === 'new' ? form.flightNo.trim().toUpperCase() : flights.find((item) => item.flight_id === flightId)?.flight_no,
        milestoneCount: result.milestone_count,
        approvalStatus: result.source_approval_status,
        status: result.status
      });
    } catch (error) {
      const apiMessage = error?.response?.data?.error?.message || error.message;
      setFeedback({
        severity: 'error',
        text: createdFlightId ? `${l('航班已创建，但运行计划创建失败。')} Flight ID: ${createdFlightId} · ${apiMessage}` : apiMessage
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{l('新建运行计划')}</DialogTitle>
      <DialogContent dividers>
        <Stack sx={{ gap: 2.25 }}>
          {options.isLoading ? <LinearProgress /> : null}
          {options.error ? <Alert severity="error">{options.error?.response?.data?.error?.message || options.error.message}</Alert> : null}
          {feedback ? <Alert severity={feedback.severity}>{feedback.text}</Alert> : null}

          <Alert severity="info">
            {l('运行计划以航班为主对象，创建后自动生成SZX至LGG的23个里程碑。初始状态为草稿，需由不同人员完成maker-checker发布。')}
          </Alert>

          <Stack sx={{ gap: 1 }}>
            <Typography variant="subtitle1">1. {l('选择或创建TAS至LGG航班')}</Typography>
            <RadioGroup row value={form.flightMode} onChange={update('flightMode')}>
              <FormControlLabel value="new" control={<Radio />} label={l('创建新航班')} />
              <FormControlLabel value="existing" control={<Radio />} label={l('选择已有航班')} />
            </RadioGroup>
            {form.flightMode === 'new' ? (
              <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5 }}>
                <TextField
                  required
                  fullWidth
                  label={l('航班号')}
                  value={form.flightNo}
                  onChange={update('flightNo')}
                  placeholder="C68123"
                />
                <TextField fullWidth label={l('机型')} value={form.aircraftType} onChange={update('aircraftType')} placeholder="B744F" />
                <TextField fullWidth label={l('航段')} value="TAS → LGG" disabled />
              </Stack>
            ) : (
              <TextField
                select
                required
                fullWidth
                label={l('已有TAS至LGG航班')}
                value={form.existingFlightId}
                onChange={selectExistingFlight}
              >
                {!selectableFlights.length ? (
                  <MenuItem disabled value="">
                    {l('没有可用航班，请切换到创建新航班。')}
                  </MenuItem>
                ) : null}
                {selectableFlights.map((item) => (
                  <MenuItem key={item.flight_id} value={item.flight_id}>
                    {item.flight_no} · {item.flight_date} · {item.runtime_status}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>

          <Divider />
          <Stack sx={{ gap: 1.5 }}>
            <Typography variant="subtitle1">2. {l('设置双ETD与路线基线')}</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5 }}>
              <TextField
                required
                fullWidth
                type="datetime-local"
                label={l('Baseline ETD（绩效基准）')}
                value={form.baselineEtd}
                onChange={update('baselineEtd')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                required
                fullWidth
                type="datetime-local"
                label={l('Current ETD（当前运营）')}
                value={form.currentOperatingEtd}
                onChange={update('currentOperatingEtd')}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {l('以上时间按塔什干时区UTC+5录入；后续ETD变化不会覆盖Baseline ETD。')}
            </Typography>
            <TextField
              select
              required
              fullWidth
              label={l('路线模板')}
              value={form.routeTemplateCode}
              onChange={update('routeTemplateCode')}
            >
              {routes.map((item) => (
                <MenuItem
                  key={`${item.route_template_id}-${item.version_no}`}
                  value={item.route_template_code}
                  disabled={item.route_template_code !== V2_ROUTE || item.status === 'RETIRED'}
                >
                  {item.route_template_code} · v{item.version_no} · {item.schedule_approval_status}
                </MenuItem>
              ))}
            </TextField>
            {selectedRoute ? (
              <Alert severity={productionAllowed ? 'success' : 'warning'}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography>
                    {l(productionAllowed ? '路线已批准用于生产。' : '当前路线仅用于试运行，不能作为生产SLA或供应商绩效基线。')}
                  </Typography>
                  <StatusChip label={selectedRoute.schedule_approval_status} />
                </Stack>
              </Alert>
            ) : null}
          </Stack>

          <Divider />
          <Stack sx={{ gap: 1.5 }}>
            <Typography variant="subtitle1">3. {l('运行属性')}</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5 }}>
              <TextField fullWidth label={l('项目代码')} value={form.projectCode} onChange={update('projectCode')} />
              <TextField fullWidth label={l('航班时区')} value={form.flightTimezone} disabled />
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.productionMode}
                  disabled={!productionAllowed}
                  onChange={(event) => setForm((current) => ({ ...current, productionMode: event.target.checked }))}
                />
              }
              label={l('创建生产运行计划')}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          {l('取消')}
        </Button>
        <Button disabled={!isComplete || busy || options.isLoading} variant="contained" onClick={submit}>
          {busy ? l('创建中…') : l('创建计划草稿')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
