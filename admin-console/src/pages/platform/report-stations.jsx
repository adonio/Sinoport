import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { useGetPlatformGovernanceComparison, useGetStationAcceptanceRecordTemplate } from 'api/platform';
import { Link as RouterLink } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function PlatformReportStationsPage() {
  const stationId = 'MME';
  const { comparisonAnchor, comparisonRows, metricRows, issueBacklogRows, differencePathRows } =
    useGetPlatformGovernanceComparison(stationId);
  const { stationAcceptanceRecordTemplate, acceptanceTemplateFields } = useGetStationAcceptanceRecordTemplate(stationId);
  const rows = comparisonRows;
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station Comparison"
          title={formatLocalizedMessage(intl, '站点对比报表')}
          description={formatLocalizedMessage(intl, '用于比较强控制站、协同控制站和待接入站之间的 SLA、闭环率和准备度差异。')}
          chips={['URC', 'MME', 'MST', 'RZE']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/reports" variant="outlined">
                {formatLocalizedMessage(intl, '返回平台报表')}
              </Button>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                {formatLocalizedMessage(intl, '站点总览')}
              </Button>
            </Stack>
          }
        />
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '对比锚点')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '报表日期')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '生成时间')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '时区')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow hover>
                <TableCell>{comparisonAnchor?.reportDate || '--'}</TableCell>
                <TableCell>{comparisonAnchor?.reportAnchor || '--'}</TableCell>
                <TableCell>{comparisonAnchor?.baselineStationCode || '--'}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '当前最小对比集固定为“MME 真实主站 + RZE 模板对照站”')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '站点对比')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '类型')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '站点')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '控制')}</TableCell>
                <TableCell>{localizeUiText(intl.locale, 'Inbound SLA')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, 'POD 闭环率')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '异常闭环时长')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '准备度')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '质量门槛')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '锚点')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>{item.comparisonType === 'template' ? formatLocalizedMessage(intl, '模板对照') : formatLocalizedMessage(intl, '真实日报')}</TableCell>
                  <TableCell>{l(item.station)}</TableCell>
                  <TableCell>{l(item.control)}</TableCell>
                  <TableCell>{item.inboundSla}</TableCell>
                  <TableCell>{item.podClosure}</TableCell>
                  <TableCell>{item.exceptionAging}</TableCell>
                  <TableCell>{l(item.readiness)}</TableCell>
                  <TableCell>{item.qualityGate || '--'}</TableCell>
                  <TableCell>{item.reportAnchor || '--'}</TableCell>
                  <TableCell>{l(item.comparisonNote || item.blockingReason || '--')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '治理差异指标')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '指标')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '主样板站')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '模板对照站')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '状态')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metricRows.map((item) => (
                <TableRow key={item.metric_key} hover>
                  <TableCell>{l(item.label)}</TableCell>
                  <TableCell>{item.actual}</TableCell>
                  <TableCell>{item.template}</TableCell>
                  <TableCell>{l(item.status)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '差异定位路径')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '步骤')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '动作')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '来源')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {differencePathRows.map((item) => (
                <TableRow key={item.step} hover>
                  <TableCell>{item.step}</TableCell>
                  <TableCell>{l(item.label)}</TableCell>
                  <TableCell>{l(item.source)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '问题回收列表')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '问题')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '严重级别')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '来源')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '下一步')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {issueBacklogRows.map((item) => (
                <TableRow key={item.issue_key} hover>
                  <TableCell>{item.issue_key}</TableCell>
                  <TableCell>{l(item.severity)}</TableCell>
                  <TableCell>{l(item.source)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                  <TableCell>{l(item.next_action)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '接入验收记录模板')}>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <div>{formatLocalizedMessage(intl, '站点')}：{stationAcceptanceRecordTemplate?.stationCode || '--'}</div>
            <div>{formatLocalizedMessage(intl, '模板包')}：{stationAcceptanceRecordTemplate?.templateKey || '--'}</div>
            <div>{formatLocalizedMessage(intl, '验收结论选项')}：{(stationAcceptanceRecordTemplate?.acceptanceDecisionOptions || []).map(l).join(' / ') || '--'}</div>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '字段')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '标签')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '必填')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '来源')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {acceptanceTemplateFields.map((item) => (
                <TableRow key={item.field_key} hover>
                  <TableCell>{item.field_key}</TableCell>
                  <TableCell>{l(item.label)}</TableCell>
                  <TableCell>{item.required ? formatLocalizedMessage(intl, '是') : formatLocalizedMessage(intl, '否')}</TableCell>
                  <TableCell>{l(item.source)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
