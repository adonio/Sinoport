import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import { useGetStationReportsOverview } from 'api/station';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function StationReportsPage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const {
    reportMeta,
    pdaKpiRows,
    shiftReportRows,
    stationFileReportRows,
    stationReportCards,
    outboundActionRows,
    stationDailyReportRows,
    qualitySummaryRows,
    qualityChecklistRows,
    refreshPolicyRows,
    traceabilityRows
  } = useGetStationReportsOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('货站报表')}
          title={m('货站层 KPI / 报表')}
          description={m('展示货站层 KPI 和班次报表，为第二批主演示链路提供日报 / 周报前端 demo。')}
          chips={[m('12 小时完成率'), m('装车准确率'), m('POD 闭环率'), m('异常时长')]}
          action={
            <Button component={RouterLink} to="/station/reports/shift" variant="outlined">
              {m('班次报表')}
            </Button>
          }
        />
      </Grid>
      {stationReportCards.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            {...item}
            title={localizeUiText(locale, item.title)}
            helper={localizeUiText(locale, item.helper)}
            chip={localizeUiText(locale, item.chip)}
          />
        </Grid>
      ))}
      <Grid size={12}>
        <MainCard title={m('日报生成锚点')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('报表类型')}</TableCell>
                <TableCell>{m('站点')}</TableCell>
                <TableCell>{m('报表日期')}</TableCell>
                <TableCell>{m('时区')}</TableCell>
                <TableCell>{m('生成时间')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow hover>
                <TableCell>{localizeUiText(locale, reportMeta?.reportType || '--')}</TableCell>
                <TableCell>{localizeUiText(locale, reportMeta?.stationId || '--')}</TableCell>
                <TableCell>{localizeUiText(locale, reportMeta?.reportDate || '--')}</TableCell>
                <TableCell>{localizeUiText(locale, reportMeta?.timeZone || '--')}</TableCell>
                <TableCell>{localizeUiText(locale, reportMeta?.generatedAt || '--')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={m('货站日报核心指标')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('区块')}</TableCell>
                <TableCell>{m('指标')}</TableCell>
                <TableCell>{m('当前值')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationDailyReportRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{localizeUiText(locale, item.section)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.metric)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={12}>
        <MainCard title={m('班次报表摘要')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('班次')}</TableCell>
                <TableCell>{m('班组')}</TableCell>
                <TableCell>{m('完成数')}</TableCell>
                <TableCell>{m('装车准确率')}</TableCell>
                <TableCell>{m('POD 闭环率')}</TableCell>
                <TableCell>{m('异常时长')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shiftReportRows.map((item) => (
                <TableRow key={item.shift} hover>
                  <TableCell>{localizeUiText(locale, item.shift)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.team)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.completed)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.loadingAccuracy)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.podClosure)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.exceptionAge)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={m('PDA KPI 样例')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('指标')}</TableCell>
                <TableCell>{m('当前值')}</TableCell>
                <TableCell>{m('目标')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pdaKpiRows.map((item) => (
                <TableRow key={item.metric} hover>
                  <TableCell>{localizeUiText(locale, item.metric)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.target)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={m('文件报表样例')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('报表项')}</TableCell>
                <TableCell>{m('对象')}</TableCell>
                <TableCell>{m('当前样例')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationFileReportRows.map((item) => (
                <TableRow key={item.report} hover>
                  <TableCell>{localizeUiText(locale, item.report)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.object)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={m('数据质量摘要')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('区块')}</TableCell>
                <TableCell>{m('指标')}</TableCell>
                <TableCell>{m('当前值')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {qualitySummaryRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{localizeUiText(locale, item.section)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.metric)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={m('质量检查表')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('区块')}</TableCell>
                <TableCell>{m('检查项')}</TableCell>
                <TableCell>{m('当前值')}</TableCell>
                <TableCell>{m('动作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {qualityChecklistRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{localizeUiText(locale, item.section)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.metric)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={m('刷新规则')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('区块')}</TableCell>
                <TableCell>{m('指标')}</TableCell>
                <TableCell>{m('当前值')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {refreshPolicyRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{localizeUiText(locale, item.section)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.metric)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <MainCard title={m('追溯关系')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('区块')}</TableCell>
                <TableCell>{m('指标')}</TableCell>
                <TableCell>{m('当前值')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {traceabilityRows.map((item) => (
                <TableRow key={`${item.section}-${item.metric}`} hover>
                  <TableCell>{localizeUiText(locale, item.section)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.metric)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.current)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={m('出港动作深化摘要')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('航班')}</TableCell>
                <TableCell>{m('目的站 / ETD')}</TableCell>
                <TableCell>{m('当前状态')}</TableCell>
                <TableCell>{m('动作进度')}</TableCell>
                <TableCell>{m('阻断')}</TableCell>
                <TableCell>{m('最近动作')}</TableCell>
                <TableCell align="right">{m('对象跳转')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outboundActionRows.map((item) => (
                <TableRow key={item.flightNo} hover>
                  <TableCell>{item.flightNo}</TableCell>
                  <TableCell>
                    {localizeUiText(locale, item.destination)}
                    <br />
                    {item.etd}
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.status)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.actionProgress)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.blockers)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.lastAudit)}</TableCell>
                  <TableCell align="right">
                    <Grid container spacing={1} justifyContent="flex-end">
                      <Grid>
                        <Button size="small" variant="outlined" component={RouterLink} to={item.flightRoute}>
                          {m('航班对象')}
                        </Button>
                      </Grid>
                      {item.exceptionRoute ? (
                        <Grid>
                          <Button size="small" variant="outlined" component={RouterLink} to={item.exceptionRoute}>
                            {m('阻断异常')}
                          </Button>
                        </Grid>
                      ) : null}
                    </Grid>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
