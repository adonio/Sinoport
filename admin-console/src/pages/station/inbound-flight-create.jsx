import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { createStationInboundFlight, useGetInboundFlightCreateOptions } from 'api/station';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

function createInitialForm(source = '') {
  return {
    flightNo: '',
    source,
    eta: '',
    etd: '',
    serviceLevel: 'P2',
    runtimeStatus: 'Pre-Arrival',
    notes: ''
  };
}

export default function StationInboundFlightCreatePage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const navigate = useNavigate();
  const { inboundFlightCreateOptions, inboundFlightServiceLevels, inboundFlightRuntimeStatuses } = useGetInboundFlightCreateOptions();
  const [form, setForm] = useState(() => createInitialForm(''));
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      source: current.source || inboundFlightCreateOptions[0]?.value || '',
      serviceLevel: current.serviceLevel || inboundFlightServiceLevels[0]?.value || 'P2',
      runtimeStatus: current.runtimeStatus || inboundFlightRuntimeStatuses[0]?.value || 'Pre-Arrival'
    }));
  }, [inboundFlightCreateOptions, inboundFlightRuntimeStatuses, inboundFlightServiceLevels]);

  const isComplete = useMemo(() => form.flightNo.trim() && form.source.trim() && form.eta.trim() && form.etd.trim(), [form]);

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isComplete) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await createStationInboundFlight({
        flight_no: form.flightNo.trim().toUpperCase(),
        origin_code: form.source,
        eta: form.eta,
        etd: form.etd,
        runtime_status: form.runtimeStatus,
        service_level: form.serviceLevel,
        notes: form.notes || undefined
      });

      setSubmitted({ ...form, flightId: result?.flight_id });
      setFeedback({
        severity: 'success',
        message: localizeUiText(locale, `航班 ${form.flightNo.trim().toUpperCase()} 已创建。`)
      });
      navigate(`/station/inbound/flights/${encodeURIComponent(form.flightNo.trim().toUpperCase())}`);
    } catch (error) {
      setFeedback({
        severity: 'error',
        message: error?.response?.data?.error?.message || m('航班创建失败，请稍后重试。')
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('进港 / 航班 / 新建')}
          title={m('新建航班')}
          description={m('创建新的进港航班记录，录入航班号、来源，以及最基础的 ETA / ETD 信息。')}
          chips={['ETA', 'ETD', m('航班号'), m('来源')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                {m('航班列表')}
              </Button>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                {m('提单管理')}
              </Button>
              <Button component={RouterLink} to="/station/inbound/mobile" variant="outlined">
                {m('PDA 作业终端')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title={m('航班录入表单')} subheader={m('当前先支持最小必填字段，用于快速建立进港航班主记录。')}>
          <Stack component="form" onSubmit={handleSubmit} sx={{ gap: 2.5 }}>
            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            <TextField label={m('航班号')} value={form.flightNo} onChange={handleChange('flightNo')} placeholder={m('例如：SE803')} />
            <TextField select label={m('来源')} value={form.source} onChange={handleChange('source')}>
              {inboundFlightCreateOptions.map((item) => (
                <MenuItem key={item.value} value={item.value} disabled={item.disabled}>
                  {localizeUiText(locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={m('ETA')}
              type="datetime-local"
              value={form.eta}
              onChange={handleChange('eta')}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={m('ETD')}
              type="datetime-local"
              value={form.etd}
              onChange={handleChange('etd')}
              InputLabelProps={{ shrink: true }}
            />
            <TextField select label={m('服务等级')} value={form.serviceLevel} onChange={handleChange('serviceLevel')}>
              {inboundFlightServiceLevels.map((item) => (
                <MenuItem key={item.value} value={item.value} disabled={item.disabled}>
                  {localizeUiText(locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label={m('初始状态')} value={form.runtimeStatus} onChange={handleChange('runtimeStatus')}>
              {inboundFlightRuntimeStatuses.map((item) => (
                <MenuItem key={item.value} value={item.value} disabled={item.disabled}>
                  {localizeUiText(locale, item.label)}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={m('备注')} value={form.notes} onChange={handleChange('notes')} multiline minRows={3} />

            <Stack direction="row" sx={{ gap: 1.5, justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="outlined"
                onClick={() => {
                  setForm(createInitialForm(inboundFlightCreateOptions[0]?.value || ''));
                  setSubmitted(null);
                  setFeedback(null);
                }}
              >
                {m('清空')}
              </Button>
              <Button type="submit" variant="contained" disabled={!isComplete || submitting}>
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
              <Typography color="text.secondary">{m('航班号')}</Typography>
              <Typography fontWeight={600}>{form.flightNo || m('未填写')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('来源')}</Typography>
              <Typography fontWeight={600}>{form.source ? localizeUiText(locale, form.source) : m('未选择')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('ETA')}</Typography>
              <Typography fontWeight={600}>{form.eta || m('未填写')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('ETD')}</Typography>
              <Typography fontWeight={600}>{form.etd || m('未填写')}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">{m('服务等级')}</Typography>
              <Typography fontWeight={600}>{form.serviceLevel ? localizeUiText(locale, form.serviceLevel) : m('未选择')}</Typography>
            </Stack>
          </Stack>

          <MainCard sx={{ mt: 3 }} contentSX={{ p: 2 }}>
            <Typography variant="subtitle2" color={submitted ? 'success.main' : 'text.secondary'} sx={{ mb: 0.5 }}>
              {submitted ? m('航班已正式创建') : m('表单提示')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {submitted
                ? localizeUiText(
                    locale,
                    `已创建航班：${submitted.flightNo}，来源 ${localizeUiText(locale, submitted.source)}，ETA ${submitted.eta}，ETD ${submitted.etd}。`
                  )
                : m('填完航班号、来源、ETA、ETD 四个字段后即可创建正式航班记录。')}
            </Typography>
          </MainCard>
        </MainCard>
      </Grid>
    </Grid>
  );
}
