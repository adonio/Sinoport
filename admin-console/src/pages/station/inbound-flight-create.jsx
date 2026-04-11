import { useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { inboundFlightSourceOptions } from 'data/sinoport';

const initialForm = {
  flightNo: '',
  source: inboundFlightSourceOptions[0],
  eta: '',
  etd: ''
};

export default function StationInboundFlightCreatePage() {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(null);

  const isComplete = useMemo(
    () => form.flightNo.trim() && form.source.trim() && form.eta.trim() && form.etd.trim(),
    [form]
  );

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isComplete) return;
    setSubmitted({ ...form });
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="进港 / 航班 / 新建"
          title="新建航班"
          description="创建新的进港航班记录，录入航班号、来源，以及最基础的 ETA / ETD 信息。"
          chips={['ETA', 'ETD', '航班号', '来源']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                航班列表
              </Button>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                提单管理
              </Button>
              <Button component={RouterLink} to="/station/inbound/mobile" variant="outlined">
                PDA 作业终端
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title="航班录入表单" subheader="当前先支持最小必填字段，用于快速建立进港航班主记录。">
          <Stack component="form" onSubmit={handleSubmit} sx={{ gap: 2.5 }}>
            <TextField label="航班号" value={form.flightNo} onChange={handleChange('flightNo')} placeholder="例如：SE803" />
            <TextField select label="来源" value={form.source} onChange={handleChange('source')}>
              {inboundFlightSourceOptions.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="ETA"
              type="datetime-local"
              value={form.eta}
              onChange={handleChange('eta')}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="ETD"
              type="datetime-local"
              value={form.etd}
              onChange={handleChange('etd')}
              InputLabelProps={{ shrink: true }}
            />

            <Stack direction="row" sx={{ gap: 1.5, justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="outlined"
                onClick={() => {
                  setForm(initialForm);
                  setSubmitted(null);
                }}
              >
                清空
              </Button>
              <Button type="submit" variant="contained" disabled={!isComplete}>
                创建航班
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title="录入预览">
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">航班号</Typography>
              <Typography fontWeight={600}>{form.flightNo || '未填写'}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">来源</Typography>
              <Typography fontWeight={600}>{form.source || '未选择'}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">ETA</Typography>
              <Typography fontWeight={600}>{form.eta || '未填写'}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">ETD</Typography>
              <Typography fontWeight={600}>{form.etd || '未填写'}</Typography>
            </Stack>
          </Stack>

          <MainCard sx={{ mt: 3 }} contentSX={{ p: 2 }}>
            <Typography variant="subtitle2" color={submitted ? 'success.main' : 'text.secondary'} sx={{ mb: 0.5 }}>
              {submitted ? '航班草稿已生成' : '表单提示'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {submitted
                ? `已创建航班草稿：${submitted.flightNo}，来源 ${submitted.source}，ETA ${submitted.eta}，ETD ${submitted.etd}。`
                : '填完航班号、来源、ETA、ETD 四个字段后即可创建航班草稿。'}
            </Typography>
          </MainCard>
        </MainCard>
      </Grid>
    </Grid>
  );
}
