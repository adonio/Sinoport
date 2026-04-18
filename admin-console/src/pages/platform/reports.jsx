import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import { Link as RouterLink } from 'react-router-dom';
import Stack from '@mui/material/Stack';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import { useGetPlatformReports } from 'api/platform';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { useIntl } from 'react-intl';

export default function PlatformReportsPage() {
  const {
    reportMeta,
    platformDailyReportRows,
    platformReportCards,
    platformStationReportRows,
    qualitySummaryRows,
    qualityChecklistRows,
    refreshPolicyRows,
    traceabilityRows
  } =
    useGetPlatformReports();
  const intl = useIntl();
  const normalizePlatformReportValue = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '日报SECTION') return 'Daily Section';
    if (trimmed === 'METRIC') return 'Metric';
    if (trimmed === 'CURRENT SAMPLE') return 'Current Sample';
    if (trimmed === 'DESCRIPTION') return 'Description';
    return trimmed;
  };
  const l = (value) => localizeUiText(intl.locale, normalizePlatformReportValue(value));

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Platform Reports"
          title={formatLocalizedMessage(intl, '平台级报表')}
          description={formatLocalizedMessage(intl, '展示平台层 KPI、链路 SLA、接口稳定性、异常分布和站点准备度。')}
          chips={['Platform KPI', 'Lane SLA', 'Integration Stability', 'Station Readiness']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/reports/stations" variant="outlined">
                {formatLocalizedMessage(intl, '站点对比')}
              </Button>
              <Button component={RouterLink} to="/platform/operations" variant="outlined">
                {formatLocalizedMessage(intl, '运行态势中心')}
              </Button>
            </Stack>
          }
        />
      </Grid>
      {platformReportCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '日报生成锚点')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '报表类型')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '报表日期')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '时区')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '生成时间')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow hover>
                <TableCell>{l(reportMeta?.reportType || '--')}</TableCell>
                <TableCell>{reportMeta?.reportDate || '--'}</TableCell>
                <TableCell>{reportMeta?.timeZone || '--'}</TableCell>
                <TableCell>{reportMeta?.generatedAt || '--'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '站点准备度摘要')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '站点')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '控制层级')}</TableCell>
                <TableCell>{localizeUiText(intl.locale, 'Inbound SLA')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, 'POD 闭环率')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '异常时长')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '准备度')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformStationReportRows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>{l(item.station)}</TableCell>
                  <TableCell>{l(item.control)}</TableCell>
                  <TableCell>{l(item.inboundSla)}</TableCell>
                  <TableCell>{l(item.podClosure)}</TableCell>
                  <TableCell>{l(item.exceptionAging)}</TableCell>
                  <TableCell>{l(item.readiness)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={formatLocalizedMessage(intl, '平台日报核心指标')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '日报区块')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '指标')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '当前样例')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {platformDailyReportRows.map((item) => (
                <TableRow key={item.section} hover>
                  <TableCell>{l(item.section)}</TableCell>
                  <TableCell>{l(item.metric)}</TableCell>
                  <TableCell>{l(item.current)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={formatLocalizedMessage(intl, '数据质量摘要')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '区块')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '指标')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '当前值')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {qualitySummaryRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{l(item.section)}</TableCell>
                  <TableCell>{l(item.metric)}</TableCell>
                  <TableCell>{l(item.current)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={formatLocalizedMessage(intl, '质量检查表')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '区块')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '检查项')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '当前值')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '动作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {qualityChecklistRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{l(item.section)}</TableCell>
                  <TableCell>{l(item.metric)}</TableCell>
                  <TableCell>{l(item.current)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={formatLocalizedMessage(intl, '刷新规则')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '区块')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '指标')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '当前值')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {refreshPolicyRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{l(item.section)}</TableCell>
                  <TableCell>{l(item.metric)}</TableCell>
                  <TableCell>{l(item.current)}</TableCell>
                  <TableCell>{l(item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={formatLocalizedMessage(intl, '追溯关系')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{formatLocalizedMessage(intl, '区块')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '指标')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '当前值')}</TableCell>
                <TableCell>{formatLocalizedMessage(intl, '说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {traceabilityRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{l(item.section)}</TableCell>
                  <TableCell>{l(item.metric)}</TableCell>
                  <TableCell>{l(item.current)}</TableCell>
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
