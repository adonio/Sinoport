import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import useAuth from 'hooks/useAuth';
import { createStationOutboundFlight, useGetStationFlightOptions } from 'api/station';
import { v14Endpoints, v14Post } from 'api/v14';
import { openSnackbar } from 'api/snackbar';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

function createInitialForm(destination = '', serviceLevel = 'P2', runtimeStatus = 'Scheduled') {
  return {
    flightNo: '',
    destination,
    std: '',
    etd: '',
    serviceLevel,
    runtimeStatus,
    aircraftType: '',
    notes: ''
  };
}

export default function StationOutboundFlightCreatePage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentStation = String(user?.stationScope?.[0] || '').toUpperCase();
  const { destinationOptions, serviceLevelOptions, runtimeStatusOptions, stationFlightOptionsLoading, stationFlightOptionsError } =
    useGetStationFlightOptions('outbound');
  const [form, setForm] = useState(() => createInitialForm());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      destination: current.destination || destinationOptions[0]?.value || '',
      serviceLevel: serviceLevelOptions.some((item) => item.value === current.serviceLevel)
        ? current.serviceLevel
        : serviceLevelOptions[0]?.value || 'P2',
      runtimeStatus: runtimeStatusOptions.some((item) => item.value === current.runtimeStatus)
        ? current.runtimeStatus
        : runtimeStatusOptions[0]?.value || 'Scheduled'
    }));
  }, [destinationOptions, runtimeStatusOptions, serviceLevelOptions]);

  const isTasLgg = currentStation === 'TAS' && form.destination === 'LGG';
  const isComplete = useMemo(
    () => form.flightNo.trim() && form.destination.trim() && form.std.trim() && form.serviceLevel && form.runtimeStatus,
    [form]
  );

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const resetForm = () => {
    setForm(
      createInitialForm(
        destinationOptions[0]?.value || '',
        serviceLevelOptions[0]?.value || 'P2',
        runtimeStatusOptions[0]?.value || 'Scheduled'
      )
    );
    setFeedback(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isComplete) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const flightNo = form.flightNo.trim().toUpperCase();
      if (isTasLgg) {
        await v14Post(v14Endpoints.tasOutboundTasks, {
          flight_no: flightNo,
          std_at: new Date(form.std).toISOString(),
          etd_at: form.etd ? new Date(form.etd).toISOString() : undefined,
          service_level: form.serviceLevel,
          aircraft_type: form.aircraftType.trim() || undefined,
          notes: form.notes.trim() || undefined
        });
      } else {
        await createStationOutboundFlight({
          flight_no: flightNo,
          destination_code: form.destination,
          std_at: form.std,
          etd_at: form.etd || undefined,
          runtime_status: form.runtimeStatus,
          service_level: form.serviceLevel,
          aircraft_type: form.aircraftType.trim() || undefined,
          notes: form.notes.trim() || undefined
        });
      }

      openSnackbar({
        open: true,
        message: isTasLgg
          ? `${m('航班')} ${flightNo} ${m('及 TAS 独立出港任务已创建，可以直接录入预报或开始现场收货。')}`
          : `${m('航班')} ${flightNo} ${m('已创建。')}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
      navigate(isTasLgg ? '/station/tas/outbound' : `/station/outbound/flights/${encodeURIComponent(flightNo)}`);
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.error?.message || error?.response?.data?.error?.message || m('航班创建失败，请检查输入后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('出港 / 航班 / 新建')}
          title={m('新建出港航班')}
          description={m('在当前货站建立出港航班主记录，后续可继续关联提单、装载、Manifest 和飞走节点。')}
          chips={[m('航班号'), 'STD', 'ETD', m('目的站')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/outbound/flights" variant="outlined">
                {m('航班列表')}
              </Button>
              {currentStation === 'TAS' ? (
                <Button component={RouterLink} to="/platform/occ-control" variant="outlined">
                  {m('OCC 运行控制（需权限）')}
                </Button>
              ) : null}
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title={m('出港航班录入')} subheader={m('航班号、目的站和计划起飞时间为必填项。')}>
          <Stack component="form" onSubmit={handleSubmit} sx={{ gap: 2.5 }}>
            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            {stationFlightOptionsError ? <Alert severity="error">{m('航班选项加载失败，请刷新页面后重试。')}</Alert> : null}
            {isTasLgg ? (
              <Alert severity="success">
                {m(
                  '这是 TAS 货站独立出港航班。提交后会同时建立 TAS–LGG 作业任务，可直接在 TAS 端录入货物/卡车预报或开始现场收货；OCC 计划不是前置条件。'
                )}
              </Alert>
            ) : null}

            <TextField
              required
              label={m('航班号')}
              value={form.flightNo}
              onChange={handleChange('flightNo')}
              placeholder={m('例如：SE913')}
            />
            <TextField
              required
              select
              label={m('目的站')}
              value={form.destination}
              onChange={handleChange('destination')}
              disabled={stationFlightOptionsLoading}
            >
              {destinationOptions.map((item) => (
                <MenuItem key={item.value} value={item.value} disabled={item.disabled}>
                  {localizeUiText(locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              label={m('STD（计划起飞）')}
              type="datetime-local"
              value={form.std}
              onChange={handleChange('std')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label={m('ETD（预计起飞）')}
              type="datetime-local"
              value={form.etd}
              onChange={handleChange('etd')}
              helperText={m('尚无预计起飞时间时可以留空，后续在航班详情更新。')}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField required select label={m('服务等级')} value={form.serviceLevel} onChange={handleChange('serviceLevel')}>
              {serviceLevelOptions.map((item) => (
                <MenuItem key={item.value} value={item.value} disabled={item.disabled}>
                  {localizeUiText(locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField required select label={m('初始状态')} value={form.runtimeStatus} onChange={handleChange('runtimeStatus')}>
              {runtimeStatusOptions.map((item) => (
                <MenuItem key={item.value} value={item.value} disabled={item.disabled}>
                  {localizeUiText(locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={m('机型')}
              value={form.aircraftType}
              onChange={handleChange('aircraftType')}
              placeholder={m('例如：B747-400F')}
            />
            <TextField label={m('备注')} value={form.notes} onChange={handleChange('notes')} multiline minRows={3} />

            <Stack direction="row" sx={{ gap: 1.5, justifyContent: 'flex-end' }}>
              <Button type="button" variant="outlined" onClick={resetForm}>
                {m('清空')}
              </Button>
              <Button type="submit" variant="contained" disabled={!isComplete || submitting || stationFlightOptionsLoading}>
                {submitting ? m('创建中...') : m('创建航班')}
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title={m('录入预览')}>
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('当前货站')}</Typography>
              <Typography fontWeight={600}>{currentStation || '--'}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('航班号')}</Typography>
              <Typography fontWeight={600}>{form.flightNo.trim().toUpperCase() || m('未填写')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('航段')}</Typography>
              <Typography fontWeight={600}>
                {currentStation || '--'} → {form.destination || m('未选择')}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">STD</Typography>
              <Typography fontWeight={600}>{form.std || m('未填写')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">ETD</Typography>
              <Typography fontWeight={600}>{form.etd || m('待更新')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('初始状态')}</Typography>
              <Typography fontWeight={600}>{form.runtimeStatus ? localizeUiText(locale, form.runtimeStatus) : m('未选择')}</Typography>
            </Stack>
          </Stack>

          <MainCard sx={{ mt: 3 }} contentSX={{ p: 2 }}>
            <Typography variant="subtitle2" color={isTasLgg ? 'success.main' : 'text.secondary'} sx={{ mb: 0.5 }}>
              {isTasLgg ? m('TAS → LGG 后续动作') : m('创建后的下一步')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isTasLgg
                ? m('创建成功后进入“TAS-LGG 出港作业”，可录入预报、逐箱收货、ULD/散货、装机和起飞；上游/OCC 数据若存在会作为补充关联。')
                : m('创建成功后进入航班详情，可继续维护提单、装载、Manifest 和航班状态。')}
            </Typography>
          </MainCard>
        </MainCard>
      </Grid>
    </Grid>
  );
}
