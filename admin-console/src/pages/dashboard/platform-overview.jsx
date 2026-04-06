import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { pendingLaunchItems, platformKpis, routeMatrix, stationCatalog } from 'data/sinoport';

export default function PlatformOverviewPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Platform Admin"
          title="Sinoport 平台管理后台"
          description="平台侧负责新增货站、维护航线网络、统一主数据、配置服务等级与硬门槛规则，再按站点进入各货站后台执行治理。"
          chips={['Network Governance', 'Station Provisioning', 'Rules & Interfaces']}
          action={
            <Button component={RouterLink} to="/platform/stations" variant="contained">
              新增货站入口
            </Button>
          }
        />
      </Grid>

      {platformKpis.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard {...item} />
        </Grid>
      ))}

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title="货站网络总览" subheader="按货站查看控制深度、接入状态和当前服务范围">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>站点</TableCell>
                <TableCell>区域</TableCell>
                <TableCell>控制层级</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>服务范围</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationCatalog.map((station) => (
                <TableRow key={station.code} hover>
                  <TableCell>
                    <Stack>
                      <Typography variant="subtitle2">{station.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {station.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{station.region}</TableCell>
                  <TableCell>
                    <StatusChip label={station.control} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={station.phase} />
                  </TableCell>
                  <TableCell>{station.scope}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="待推进事项" subheader="平台侧近期必须完成的网络治理动作">
          <List disablePadding>
            {pendingLaunchItems.map((item) => (
              <ListItem key={item.title} divider>
                <ListItemText
                  primary={item.title}
                  secondary={`${item.owner} · ${item.due} · ${item.note}`}
                  primaryTypographyProps={{ variant: 'subtitle2' }}
                />
              </ListItem>
            ))}
          </List>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title="主航线与事件覆盖" subheader="航线不是静态表，而是平台侧治理责任与事件可见性的载体">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>链路</TableCell>
                <TableCell>业务模式</TableCell>
                <TableCell>参与站点</TableCell>
                <TableCell>承诺口径</TableCell>
                <TableCell>关键事件</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {routeMatrix.map((route) => (
                <TableRow key={route.lane} hover>
                  <TableCell>{route.lane}</TableCell>
                  <TableCell>{route.pattern}</TableCell>
                  <TableCell>{route.stations}</TableCell>
                  <TableCell>{route.promise}</TableCell>
                  <TableCell>{route.events}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
