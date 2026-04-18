import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import BlockingReasonAlert from 'components/sinoport/BlockingReasonAlert';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { useGetPlatformOperationsOverview } from 'api/platform';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function PlatformOperationsPage() {
  const intl = useIntl();
  const locale = intl.locale;
  const m = (value) => formatLocalizedMessage(intl, value);
  const { platformAlerts, platformOperationKpis, platformPendingActions, stationAuditFeed, stationHealthRows } =
    useGetPlatformOperationsOverview();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Operations Center"
          title={m('运行态势中心')}
          description={m('平台侧以链路健康、站点风险、接口告警、待审批动作和关键事件为主视角，统一观察全网履约运行态势。')}
          chips={['Network Health', 'Blocked Lanes', 'Pending Actions', 'Integration Alerts', 'Audit Feed']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations" variant="outlined">
                {m('货站与资源管理')}
              </Button>
              <Button component={RouterLink} to="/platform/rules" variant="outlined">
                {m('规则与指令引擎')}
              </Button>
              <Button component={RouterLink} to="/platform/master-data" variant="outlined">
                {m('主数据与接口治理')}
              </Button>
              <Button component={RouterLink} to="/platform/reports" variant="outlined">
                {m('平台报表')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <BlockingReasonAlert title={m('平台级当前风险')} reasons={platformAlerts.filter((item) => item.status === '阻塞').map((item) => item.title)} />
      </Grid>

      {platformOperationKpis.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} title={localizeUiText(locale, item.title)} helper={localizeUiText(locale, item.helper)} chip={localizeUiText(locale, item.chip)} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, lg: 4 }}>
        <TaskQueueCard
          title={m('链路与接口告警')}
          items={platformAlerts.map((item) => ({
            id: item.id,
            title: localizeUiText(locale, item.title),
            description: localizeUiText(locale, item.description),
            status: localizeUiText(locale, item.status)
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <TaskQueueCard
          title={m('待处理动作')}
          items={platformPendingActions.map((item) => ({
            id: item.id,
            title: localizeUiText(locale, item.title),
            description: localizeUiText(locale, item.note),
            meta: `${localizeUiText(locale, item.owner)} · ${m('截止')} ${item.due}`,
            status: localizeUiText(locale, item.status)
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title={m('关键事件回放')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('时间')}</TableCell>
                <TableCell>{m('动作')}</TableCell>
                <TableCell>{m('对象')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationAuditFeed.slice(0, 4).map((item) => (
                <TableRow key={`${item.time}-${item.object}`} hover>
                  <TableCell>{item.time}</TableCell>
                  <TableCell>{localizeUiText(locale, item.action)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{localizeUiText(locale, item.object)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {localizeUiText(locale, item.actor)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={m('站点健康度矩阵')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('站点')}</TableCell>
                <TableCell>{m('控制层级')}</TableCell>
                <TableCell>{m('阶段')}</TableCell>
                <TableCell>{m('准备度')}</TableCell>
                <TableCell>{m('当前风险')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationHealthRows.map((item) => (
                <TableRow key={item.code} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{item.code}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {localizeUiText(locale, item.name)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.control)} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, item.phase)} />
                  </TableCell>
                  <TableCell>{item.readiness}%</TableCell>
                  <TableCell>{localizeUiText(locale, item.blockingReason)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
